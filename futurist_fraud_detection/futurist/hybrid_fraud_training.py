# hybrid_fraud_training.py

import os
import json
import joblib
import numpy as np
import pandas as pd
import logging
from pymongo import MongoClient
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score
from imblearn.over_sampling import SMOTE, ADASYN
from sklearn.ensemble import IsolationForest
from xgboost import XGBClassifier

# ----------------------
# Logging setup
# ----------------------
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
fh = logging.FileHandler('hybrid_fraud_training.log')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)
fh.setFormatter(formatter)
logger.addHandler(ch)
logger.addHandler(fh)

# ----------------------
# Config
# ----------------------
CONFIG = {
    'mongo_uri': "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce",
    'db_name': "futurist_e-commerce",
    'collection_name': "LedgerTransaction",
    'oversample_method': 'smote',  # 'smote' or 'adasyn'
    'test_size': 0.2,
    'random_state': 42,
    'xgb_param_search': True,      
    'cv_folds': 3,
    'n_iter': 10,                  
    'contamination': 0.01,         
    'models_dir': "models"
}

# ----------------------
# Load data from Mongo
# ----------------------
def load_mongo_data():
    client = MongoClient(CONFIG['mongo_uri'])
    db = client[CONFIG['db_name']]
    collection = db[CONFIG['collection_name']]
    data = pd.DataFrame(list(collection.find()))
    logger.info(f"Loaded {len(data)} documents from MongoDB")
    return data

# ----------------------
# Preprocess data / prepare features
# ----------------------
def preprocess_data(data):
    # Ensure all required columns exist
    required_fields = [
        "step", "type", "amount", "nameOrig", "oldbalanceOrg",
        "newbalanceOrig", "nameDest", "oldbalanceDest", "newbalanceDest",
        "isFraud", "isFlaggedFraud"
    ]
    for field in required_fields:
        if field not in data.columns:
            data[field] = np.nan

    # Target
    data["isFraudCombined"] = ((data["isFraud"] == 1) | (data["isFlaggedFraud"] == 1)).astype(int)

    # Derived features
    data["deltaOrg"] = data["oldbalanceOrg"] - data["newbalanceOrig"]
    data["deltaDest"] = data["newbalanceDest"] - data["oldbalanceDest"]

    # One-hot encode 'type'
    onehot = OneHotEncoder(handle_unknown="ignore", sparse=False)
    type_encoded = onehot.fit_transform(data[["type"]].fillna("UNKNOWN"))
    type_encoded_df = pd.DataFrame(type_encoded, columns=onehot.get_feature_names_out(["type"]))

    # Label encode nameOrig / nameDest
    le_nameOrig = LabelEncoder()
    le_nameDest = LabelEncoder()
    data["nameOrig_encoded"] = le_nameOrig.fit_transform(data["nameOrig"].astype(str))
    data["nameDest_encoded"] = le_nameDest.fit_transform(data["nameDest"].astype(str))

    # Final features
    X = pd.concat([
        data[[
            "step", "amount", "oldbalanceOrg", "newbalanceOrig",
            "oldbalanceDest", "newbalanceDest", "deltaOrg", "deltaDest",
            "nameOrig_encoded", "nameDest_encoded"
        ]],
        type_encoded_df
    ], axis=1)

    y = data["isFraudCombined"]

    return X, y, onehot, le_nameOrig, le_nameDest

# ----------------------
# Oversampling
# ----------------------
def oversample(X, y):
    if CONFIG['oversample_method'].lower() == 'smote':
        sampler = SMOTE(random_state=CONFIG['random_state'])
    else:
        sampler = ADASYN(random_state=CONFIG['random_state'])
    return sampler.fit_resample(X, y)

# ----------------------
# Scale features
# ----------------------
def scale_features(X_train, X_test):
    scaler = StandardScaler()
    return scaler.fit_transform(X_train), scaler.transform(X_test), scaler

# ----------------------
# Train supervised XGBoost
# ----------------------
def train_xgb(X_train, y_train):
    if CONFIG['xgb_param_search']:
        xgb = XGBClassifier(
            tree_method='hist',
            eval_metric='logloss',
            use_label_encoder=False,
            random_state=CONFIG['random_state']
        )
        param_dist = {
            'n_estimators': [100, 200, 300],
            'max_depth': [3, 5, 7],
            'learning_rate': [0.01, 0.1, 0.2],
            'subsample': [0.7, 0.8, 1.0],
            'colsample_bytree': [0.7, 0.8, 1.0]
        }
        skf = StratifiedKFold(
            n_splits=CONFIG['cv_folds'],
            shuffle=True,
            random_state=CONFIG['random_state']
        )
        search = RandomizedSearchCV(
            xgb,
            param_distributions=param_dist,
            n_iter=CONFIG['n_iter'],
            scoring='roc_auc',
            cv=skf,
            n_jobs=-1,
            verbose=2,
            random_state=CONFIG['random_state']
        )
        search.fit(X_train, y_train)
        logger.info(f"XGBoost best params: {search.best_params_}")
        return search.best_estimator_
    else:
        model = XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            tree_method='hist',
            eval_metric='logloss',
            use_label_encoder=False,
            random_state=CONFIG['random_state']
        )
        model.fit(X_train, y_train)
        return model

# ----------------------
# Train Isolation Forest (dynamic contamination)
# ----------------------
def train_isolation_forest(X_full, y=None, contamination=None):
    """
    Train Isolation Forest.
    - X_full: raw feature matrix
    - y: optional, used to estimate contamination if not provided
    - contamination: if provided, overrides automatic estimation
    """
    if contamination is not None:
        iso_contam = contamination
    elif y is not None:
        iso_contam = max(0.001, min(0.5, y.sum() / len(y)))  # avoid 0 or >50%
        logger.info(f"Estimated contamination from data: {iso_contam:.4f}")
    else:
        iso_contam = CONFIG.get('contamination', 0.01)
        logger.info(f"Using default contamination: {iso_contam:.4f}")

    iso_model = IsolationForest(
        n_estimators=200,
        contamination=iso_contam,
        random_state=CONFIG['random_state'],
        n_jobs=-1
    )
    iso_model.fit(X_full)
    logger.info(f"Isolation Forest trained on full raw dataset with contamination={iso_contam:.4f}")
    return iso_model, iso_contam

# ----------------------
# Save artifacts
# ----------------------
def save_artifacts(xgb_model, iso_model, iso_contam, scaler, onehot, le_nameOrig, le_nameDest, feature_list):
    os.makedirs(CONFIG['models_dir'], exist_ok=True)
    joblib.dump(xgb_model, os.path.join(CONFIG['models_dir'], "xgb_fraud_model.pkl"))
    joblib.dump(iso_model, os.path.join(CONFIG['models_dir'], "isolation_forest.pkl"))
    joblib.dump(iso_contam, os.path.join(CONFIG['models_dir'], "iso_contamination.pkl"))
    joblib.dump(scaler, os.path.join(CONFIG['models_dir'], "scaler.pkl"))
    joblib.dump(onehot, os.path.join(CONFIG['models_dir'], "onehot_type.pkl"))
    joblib.dump(le_nameOrig, os.path.join(CONFIG['models_dir'], "labelencoder_nameOrig.pkl"))
    joblib.dump(le_nameDest, os.path.join(CONFIG['models_dir'], "labelencoder_nameDest.pkl"))
    with open(os.path.join(CONFIG['models_dir'], "features.json"), "w") as f:
        json.dump(feature_list, f)
    logger.info("✅ Models, contamination, and encoders saved successfully!")

# ----------------------
# Main
# ----------------------
def main():
    data = load_mongo_data()
    X, y, onehot, le_nameOrig, le_nameDest = preprocess_data(data)

    # Oversample only for XGBoost
    X_resampled, y_resampled = oversample(X, y)
    X_train, X_test, y_train, y_test = train_test_split(
        X_resampled, y_resampled,
        test_size=CONFIG['test_size'],
        stratify=y_resampled,
        random_state=CONFIG['random_state']
    )

    X_train_scaled, X_test_scaled, scaler = scale_features(X_train, X_test)

    # Train models
    xgb_model = train_xgb(X_train_scaled, y_train)
    iso_model, iso_contam = train_isolation_forest(X)  # raw full data for IF

    # Save artifacts
    save_artifacts(xgb_model, iso_model, iso_contam, scaler, onehot, le_nameOrig, le_nameDest, list(X.columns))

    # Test ROC-AUC
    y_test_proba = xgb_model.predict_proba(X_test_scaled)[:, 1]
    roc_auc = roc_auc_score(y_test, y_test_proba)
    logger.info(f"XGBoost Test ROC-AUC: {roc_auc:.4f}")
    print(f"XGBoost Test ROC-AUC: {roc_auc:.4f}")

if __name__ == "__main__":
    main()
