# train_customer_segmentation.py
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import joblib

# Load dataset
df = pd.read_csv(r"C:\Users\ASUS\Desktop\futurist\python\customer_segmentation\data\data.csv", encoding='ISO-8859-1')

# --- CLEANING (shortened from your script) ---
df.dropna(subset=['CustomerID'], inplace=True)
df.drop_duplicates(inplace=True)
df = df[~df['InvoiceNo'].str.startswith('C')]
df = df[df['UnitPrice'] > 0]
df["TotalPrice"] = df["Quantity"] * df["UnitPrice"]
df["Date"] = pd.to_datetime(df["InvoiceDate"])

# --- RFM Calculation ---
reference_date = max(df["Date"]) + pd.DateOffset(days=1)
recency = (reference_date - df.groupby('CustomerID')["Date"].max()).dt.days
frequency = df.groupby('CustomerID')['Date'].count()
monetary = df.groupby('CustomerID')['TotalPrice'].sum()

rfm = pd.DataFrame({
    "Recency": recency,
    "Frequency": frequency,
    "Monetary": monetary
}).reset_index()

# Log transform
rfm['Recency'] = np.log1p(rfm['Recency'])
rfm['Frequency'] = np.log1p(rfm['Frequency'])
rfm['Monetary'] = np.log1p(rfm['Monetary'])

# Scale
scaler = StandardScaler()
rfm_scaled = scaler.fit_transform(rfm[['Recency','Frequency','Monetary']])

# Train KMeans
kmeans = KMeans(n_clusters=4, random_state=14)
kmeans.fit(rfm_scaled)

# Save models
joblib.dump(kmeans, "models/kmeans.pkl")
joblib.dump(scaler, "models/scaler.pkl")

# Save cluster labels mapping
cluster_label = {0: 'At Risk', 
                 1: 'Champions', 
                 2: 'Loyal Customers', 
                 3: 'New Customers'}
joblib.dump(cluster_label, "models/cluster_labels.pkl")

print("✅ Model, Scaler, and Labels saved to /models/")
