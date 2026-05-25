"""
train_ner.py
Fine-tune a spaCy NER model on the network configuration dataset.

Usage:
    pip install spacy
    python -m spacy download en_core_web_sm
    python train_ner.py --data ../dataset/network_config_dataset.jsonl \\
                       --output ../backend/ner_model \\
                       --iterations 30

The trained model is written to ../backend/ner_model and is auto-detected
by network_ner.py at request time (no code change needed in the API layer).

This is intentionally a Stage 2 enhancement: the rule-based extractor
already covers the assigned task end-to-end. Training the model here lets
the system generalize to paraphrased sentences ("send the data starting
at R1 and arriving at R7") that fall outside the regex patterns.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path


def load_data(path: Path) -> list[tuple[str, dict]]:
    """Read JSONL dataset and convert to spaCy training format."""
    examples = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            entities = [(start, end, label) for start, end, label in rec["entities"]]
            examples.append((rec["text"], {"entities": entities}))
    return examples


def train(data_path: Path, output_dir: Path, iterations: int, seed: int) -> None:
    """Train a fresh spaCy NER pipeline (blank English base)."""
    try:
        import spacy
        from spacy.training import Example
    except ImportError:
        raise SystemExit(
            "spaCy is not installed. Run: pip install spacy && "
            "python -m spacy download en_core_web_sm"
        )

    examples_raw = load_data(data_path)
    random.seed(seed)
    random.shuffle(examples_raw)

    # 80/20 train/dev split
    split = int(len(examples_raw) * 0.8)
    train_raw = examples_raw[:split]
    dev_raw = examples_raw[split:]
    print(f"Loaded {len(examples_raw)} examples ({len(train_raw)} train / {len(dev_raw)} dev)")

    # Blank English pipeline + fresh NER component
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner")

    labels = {"SOURCE_NODE", "DESTINATION_NODE", "INTERMEDIATE_NODE", "BANDWIDTH", "PACKET_LOSS"}
    for label in labels:
        ner.add_label(label)

    # Convert to Example objects
    train_examples = [
        Example.from_dict(nlp.make_doc(text), ann) for text, ann in train_raw
    ]
    dev_examples = [
        Example.from_dict(nlp.make_doc(text), ann) for text, ann in dev_raw
    ]

    optimizer = nlp.begin_training()
    for itn in range(iterations):
        random.shuffle(train_examples)
        losses: dict = {}
        for example in train_examples:
            nlp.update([example], drop=0.3, losses=losses, sgd=optimizer)

        # Light dev evaluation
        if dev_examples:
            scores = nlp.evaluate(dev_examples)
            print(
                f"iter {itn + 1:02d} | loss={losses.get('ner', 0):.3f} "
                f"| P={scores.get('ents_p', 0):.2f} "
                f"R={scores.get('ents_r', 0):.2f} "
                f"F1={scores.get('ents_f', 0):.2f}"
            )
        else:
            print(f"iter {itn + 1:02d} | loss={losses.get('ner', 0):.3f}")

    output_dir.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(output_dir)
    print(f"\nModel saved to {output_dir}")
    print("network_ner.py will auto-load it on the next request.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        type=Path,
        default=Path(__file__).parent.parent / "dataset" / "network_config_dataset.jsonl",
        help="Path to the JSONL dataset.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "backend" / "ner_model",
        help="Where to save the trained model.",
    )
    parser.add_argument("--iterations", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    train(args.data, args.output, args.iterations, args.seed)


if __name__ == "__main__":
    main()
