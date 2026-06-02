import os
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

def convert():
    model_id = "dima806/email-spam-detection-distilbert"
    print(f"Loading tokenizer and model for {model_id}...")
    
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSequenceClassification.from_pretrained(model_id)
    model.eval()
    
    # Create target directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # Tokenizer save path
    tokenizer_dir = os.path.join(models_dir, "spam_tokenizer")
    os.makedirs(tokenizer_dir, exist_ok=True)
    tokenizer.save_pretrained(tokenizer_dir)
    print(f"Tokenizer saved to {tokenizer_dir}")
    
    # ONNX save path
    onnx_path = os.path.join(models_dir, "spam_model.onnx")
    
    # Trace inputs
    dummy_input = tokenizer("Verify that this input structure matches the model.", return_tensors="pt")
    
    print(f"Exporting model to ONNX format at {onnx_path}...")
    torch.onnx.export(
        model,
        (dummy_input["input_ids"], dummy_input["attention_mask"]),
        onnx_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size"}
        },
        opset_version=12
    )
    print("ONNX conversion complete! Model is ready.")

if __name__ == "__main__":
    convert()
