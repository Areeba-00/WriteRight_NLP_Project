"""
Generate a labeled dataset of network configuration sentences for NER training.

Produces dataset/network_config_dataset.jsonl with one JSON object per line:
{
    "text": "...",
    "entities": [
        {"start": 0, "end": 8, "label": "SOURCE_NODE"},
        ...
    ]
}

Character spans are computed programmatically, so they are always correct
(no manual annotation drift). Run this once before training.
"""

import json
import random
from pathlib import Path

random.seed(42)

# ---------- vocabularies ----------

NODE_NAMES = [
    "Router A", "Router B", "Router C", "Router D", "Router E", "Router F",
    "Node 1", "Node 2", "Node 3", "Node 4", "Node 5", "Node 6", "Node 7",
    "Switch A", "Switch B", "Switch X", "Switch Y",
    "Server 1", "Server 2", "Server Alpha", "Server Beta",
    "Gateway 1", "Gateway 2", "Edge Router 1", "Edge Router 2",
    "Host A", "Host B", "Firewall 1", "Firewall 2",
]

BANDWIDTHS = [
    "10 Mbps", "50 Mbps", "100 Mbps", "200 Mbps", "500 Mbps",
    "1 Gbps", "2 Gbps", "10 Gbps", "40 Gbps",
    "25 Mbps", "75 Mbps", "150 Mbps", "300 Mbps",
]

PACKET_LOSS = [
    "below 1%", "below 2%", "below 5%",
    "less than 1%", "less than 0.5%", "less than 3%",
    "under 2%", "under 1%",
    "1%", "2%", "0.5%", "3%", "0.1%",
]

# ---------- sentence templates ----------
# Each template is a function returning (text, entity_dict).
# entity_dict maps label -> the substring that should be tagged.

def t_full_path_via(src, dst, mid, bw, pl):
    text = f"Configure traffic from {src} to {dst} via {mid} with bandwidth {bw} and packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_full_path_through(src, dst, mid, bw, pl):
    text = f"Send data from {src} to {dst} through {mid} with {bw} bandwidth and {pl} packet loss."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_route_packets(src, dst, mid, bw, pl):
    text = f"Route packets from {src} to {dst} via {mid} at {bw} with packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_establish_link(src, dst, mid, bw, pl):
    text = f"Establish a link from {src} to {dst} through {mid}, bandwidth {bw}, packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_no_mid_with_pl(src, dst, bw, pl):
    text = f"Configure a connection from {src} to {dst} with {bw} bandwidth and packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_no_mid_no_pl(src, dst, bw):
    text = f"Send traffic from {src} to {dst} at {bw}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst, "BANDWIDTH": bw}

def t_no_bw(src, dst, mid, pl):
    text = f"Route packets from {src} to {dst} via {mid} with packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "PACKET_LOSS": pl}

def t_no_pl(src, dst, mid, bw):
    text = f"Forward traffic from {src} to {dst} through {mid} with bandwidth {bw}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw}

def t_minimal(src, dst, pl):
    text = f"Connect {src} to {dst} with packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst, "PACKET_LOSS": pl}

def t_imperative(src, dst, mid, bw, pl):
    text = f"Set up a path from {src} to {dst} hopping through {mid}, bandwidth {bw}, packet loss {pl}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_reorder(src, dst, mid, bw, pl):
    text = f"With bandwidth {bw} and packet loss {pl}, configure traffic from {src} to {dst} via {mid}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}

def t_bw_first(src, dst, mid, bw, pl):
    text = f"At {bw} with packet loss {pl}, route from {src} to {dst} via {mid}."
    return text, {"SOURCE_NODE": src, "DESTINATION_NODE": dst,
                  "INTERMEDIATE_NODE": mid, "BANDWIDTH": bw, "PACKET_LOSS": pl}


TEMPLATES_FULL = [t_full_path_via, t_full_path_through, t_route_packets,
                  t_establish_link, t_imperative, t_reorder, t_bw_first]
TEMPLATES_NO_MID = [t_no_mid_with_pl, t_no_mid_no_pl]
TEMPLATES_PARTIAL = [t_no_bw, t_no_pl, t_minimal]


def find_span(text, substring):
    """Return (start, end) of first occurrence of substring in text. Raise if not found."""
    start = text.find(substring)
    if start == -1:
        raise ValueError(f"Substring not found: '{substring}' in '{text}'")
    return start, start + len(substring)


def build_entities(text, entity_dict):
    """Convert {label: substring} into a sorted, non-overlapping list of spans."""
    spans = []
    for label, sub in entity_dict.items():
        start, end = find_span(text, sub)
        spans.append({"start": start, "end": end, "label": label})
    spans.sort(key=lambda s: s["start"])
    # sanity: no overlap
    for i in range(len(spans) - 1):
        if spans[i]["end"] > spans[i + 1]["start"]:
            raise ValueError(f"Overlap in entities for: {text}")
    return spans


def generate():
    examples = []

    # 50 sentences with all 5 entities (full path)
    for _ in range(50):
        tmpl = random.choice(TEMPLATES_FULL)
        src, dst, mid = random.sample(NODE_NAMES, 3)
        bw = random.choice(BANDWIDTHS)
        pl = random.choice(PACKET_LOSS)
        text, ents = tmpl(src, dst, mid, bw, pl)
        examples.append({"text": text, "entities": build_entities(text, ents)})

    # 15 sentences without intermediate node
    for _ in range(15):
        tmpl = random.choice(TEMPLATES_NO_MID)
        src, dst = random.sample(NODE_NAMES, 2)
        bw = random.choice(BANDWIDTHS)
        pl = random.choice(PACKET_LOSS)
        if tmpl is t_no_mid_with_pl:
            text, ents = tmpl(src, dst, bw, pl)
        else:
            text, ents = tmpl(src, dst, bw)
        examples.append({"text": text, "entities": build_entities(text, ents)})

    # 15 sentences with partial entities (missing bw or pl)
    for _ in range(15):
        tmpl = random.choice(TEMPLATES_PARTIAL)
        src, dst, mid = random.sample(NODE_NAMES, 3)
        bw = random.choice(BANDWIDTHS)
        pl = random.choice(PACKET_LOSS)
        if tmpl is t_no_bw:
            text, ents = tmpl(src, dst, mid, pl)
        elif tmpl is t_no_pl:
            text, ents = tmpl(src, dst, mid, bw)
        else:  # t_minimal
            text, ents = tmpl(src, dst, pl)
        examples.append({"text": text, "entities": build_entities(text, ents)})

    # de-duplicate by text
    seen = set()
    unique = []
    for ex in examples:
        if ex["text"] in seen:
            continue
        seen.add(ex["text"])
        unique.append(ex)

    random.shuffle(unique)
    return unique


if __name__ == "__main__":
    out_path = Path(__file__).resolve().parent.parent / "dataset" / "network_config_dataset.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    examples = generate()
    with out_path.open("w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"Wrote {len(examples)} examples to {out_path}")
    # quick sanity preview
    for ex in examples[:3]:
        print(json.dumps(ex, indent=2, ensure_ascii=False))
