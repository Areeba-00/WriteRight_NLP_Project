"""
Train a spaCy NER model on the network configuration dataset.

Usage (from the repo root):
    python training/train_ner.py

Produces:
    training/model-best/        # the trained pipeline (load with spacy.load)
    training/training.log       # human-readable metrics
"""

import json
import random
from pathlib import Path

import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.util import minibatch, compounding


LABELS = ["SOURCE_NODE", "DESTINATION_NODE",
          "INTERMEDIATE_NODE", "BANDWIDTH", "PACKET_LOSS"]


def load_jsonl(path: Path):
    examples = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            examples.append(json.loads(line))
    return examples


def to_spacy_format(examples):
    """Convert our JSONL format to spaCy's (text, {"entities": [(start, end, label), ...]}) format."""
    out = []
    for ex in examples:
        ents = [(e["start"], e["end"], e["label"]) for e in ex["entities"]]
        out.append((ex["text"], {"entities": ents}))
    return out


def split(data, ratio=0.85, seed=42):
    rng = random.Random(seed)
    data = data.copy()
    rng.shuffle(data)
    cut = int(len(data) * ratio)
    return data[:cut], data[cut:]


def evaluate(nlp, eval_data):
    """Per-label precision / recall / F1 plus micro-average."""
    tp = {lbl: 0 for lbl in LABELS}
    fp = {lbl: 0 for lbl in LABELS}
    fn = {lbl: 0 for lbl in LABELS}

    for text, annot in eval_data:
        gold = set((s, e, l) for s, e, l in annot["entities"])
        pred = set((ent.start_char, ent.end_char, ent.label_) for ent in nlp(text).ents)

        for span in pred:
            if span in gold:
                tp[span[2]] += 1
            else:
                fp[span[2]] += 1
        for span in gold:
            if span not in pred:
                fn[span[2]] += 1

    per_label = {}
    total_tp = total_fp = total_fn = 0
    for lbl in LABELS:
        p = tp[lbl] / (tp[lbl] + fp[lbl]) if (tp[lbl] + fp[lbl]) else 0.0
        r = tp[lbl] / (tp[lbl] + fn[lbl]) if (tp[lbl] + fn[lbl]) else 0.0
        f1 = 2 * p * r / (p + r) if (p + r) else 0.0
        per_label[lbl] = {"precision": p, "recall": r, "f1": f1,
                          "tp": tp[lbl], "fp": fp[lbl], "fn": fn[lbl]}
        total_tp += tp[lbl]; total_fp += fp[lbl]; total_fn += fn[lbl]

    micro_p = total_tp / (total_tp + total_fp) if (total_tp + total_fp) else 0.0
    micro_r = total_tp / (total_tp + total_fn) if (total_tp + total_fn) else 0.0
    micro_f1 = 2 * micro_p * micro_r / (micro_p + micro_r) if (micro_p + micro_r) else 0.0

    return {"per_label": per_label,
            "micro": {"precision": micro_p, "recall": micro_r, "f1": micro_f1}}


def train(n_iter=30, dropout=0.2):
    here = Path(__file__).resolve().parent
    dataset_path = here.parent / "dataset" / "network_config_dataset.jsonl"
    model_out = here / "model-best"
    log_out = here / "training.log"

    print(f"Loading dataset from {dataset_path}...")
    raw = load_jsonl(dataset_path)
    data = to_spacy_format(raw)
    train_data, eval_data = split(data, ratio=0.85)
    print(f"  Total: {len(data)}  |  train: {len(train_data)}  |  eval: {len(eval_data)}")

    # blank English pipeline + NER component
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner")
    for lbl in LABELS:
        ner.add_label(lbl)

    # convert train_data to Example objects (needed by recent spaCy versions)
    train_examples = []
    for text, annot in train_data:
        doc = nlp.make_doc(text)
        train_examples.append(Example.from_dict(doc, annot))

    optimizer = nlp.initialize(lambda: train_examples)

    log_lines = [f"Training spaCy NER for {n_iter} iterations on {len(train_data)} examples"]
    print(log_lines[-1])

    for itn in range(n_iter):
        random.shuffle(train_examples)
        losses = {}
        batches = minibatch(train_examples, size=compounding(4.0, 16.0, 1.5))
        for batch in batches:
            nlp.update(batch, drop=dropout, losses=losses, sgd=optimizer)
        line = f"  iter {itn + 1:>2}/{n_iter}  loss={losses.get('ner', 0.0):.3f}"
        print(line)
        log_lines.append(line)

    # final evaluation
    print("\nEvaluating on held-out set...")
    metrics = evaluate(nlp, eval_data)
    log_lines.append("\n=== Final metrics (eval set) ===")
    for lbl, m in metrics["per_label"].items():
        line = f"  {lbl:<18} P={m['precision']:.3f}  R={m['recall']:.3f}  F1={m['f1']:.3f}  (tp={m['tp']}, fp={m['fp']}, fn={m['fn']})"
        print(line); log_lines.append(line)
    micro = metrics["micro"]
    line = f"  {'MICRO AVG':<18} P={micro['precision']:.3f}  R={micro['recall']:.3f}  F1={micro['f1']:.3f}"
    print(line); log_lines.append(line)

    # save model + log
    nlp.to_disk(model_out)
    log_out.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"\nModel saved to: {model_out}")
    print(f"Log saved to:   {log_out}")


if __name__ == "__main__":
    train()
