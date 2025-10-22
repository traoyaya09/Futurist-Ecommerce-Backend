# api_customer_segmentation.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

# Load models
kmeans = joblib.load("models/kmeans.pkl")
scaler = joblib.load("models/scaler.pkl")
cluster_labels = joblib.load("models/cluster_labels.pkl")

# Init FastAPI
app = FastAPI(title="Customer Segmentation API")

# Request schema
class CustomerData(BaseModel):
    Recency: float
    Frequency: float
    Monetary: float

@app.post("/segment-customer")
def segment_customer(data: CustomerData):
    # Apply same log transform as training
    recency = np.log1p(data.Recency)
    frequency = np.log1p(data.Frequency)
    monetary = np.log1p(data.Monetary)

    # Scale input
    scaled = scaler.transform([[recency, frequency, monetary]])

    # Predict cluster
    cluster = kmeans.predict(scaled)[0]
    segment = cluster_labels[cluster]

    return {
        "cluster": int(cluster),
        "segment": segment
    }
