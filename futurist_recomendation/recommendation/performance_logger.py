import csv
import threading
from datetime import datetime

lock = threading.Lock()
CSV_FILE = "performance_metrics.csv"

# Initialize CSV if not exists
with lock:
    try:
        with open(CSV_FILE, "x", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "endpoint", "userId", "success", "fail", "min_ms", "max_ms", "avg_ms", "total_requests"])
    except FileExistsError:
        pass

def log_performance(endpoint: str, user_id: str, success: int, fail: int, min_ms: int, max_ms: int, avg_ms: float, total_requests: int):
    with lock:
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.utcnow().isoformat(),
                endpoint,
                user_id,
                success,
                fail,
                min_ms,
                max_ms,
                round(avg_ms, 2),
                total_requests
            ])
