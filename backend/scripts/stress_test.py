"""
High-Performance Async Stress Test for FastAPI & Redis Rate Limiter.
Simulates concurrent load to test server throughput and rate-limit enforcement.
"""

import asyncio
import sys
import time
from typing import Dict, List
import httpx

TARGET_URL = "http://localhost:8000/health"
TOTAL_REQUESTS = 1000
CONCURRENCY = 50


async def send_worker(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    stats: Dict,
) -> None:
    async with semaphore:
        start_time = time.perf_counter()
        try:
            res = await client.get(TARGET_URL)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            stats["status_codes"][res.status_code] = (
                stats["status_codes"].get(res.status_code, 0) + 1
            )
            stats["latencies"].append(elapsed_ms)
        except Exception:
            stats["errors"] += 1


async def run_stress_test(total: int = TOTAL_REQUESTS, concurrency: int = CONCURRENCY):
    print("=" * 60)
    print(f"🔥 Starting Stress Test: {total} requests (Concurrency: {concurrency})")
    print(f"🎯 Target Endpoint: {TARGET_URL}")
    print("=" * 60)

    semaphore = asyncio.Semaphore(concurrency)
    stats = {
        "status_codes": {},
        "latencies": [],
        "errors": 0,
    }

    start_total = time.perf_counter()

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [send_worker(client, semaphore, stats) for _ in range(total)]
        await asyncio.gather(*tasks)

    duration = time.perf_counter() - start_total
    rps = total / duration
    latencies: List[float] = sorted(stats["latencies"])

    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0

    print("\n📊 Benchmark Results:")
    print(f"  • Total Duration:     {duration:.2f} seconds")
    print(f"  • Throughput:         {rps:.1f} req/sec")
    print(f"  • HTTP Status Codes:  {stats['status_codes']}")
    print(f"  • Average Latency:    {avg_lat:.2f} ms")
    print(f"  • p50 (Median):       {p50:.2f} ms")
    print(f"  • p95:                {p95:.2f} ms")
    print(f"  • p99:                {p99:.2f} ms")
    print(f"  • Failed Requests:    {stats['errors']}")
    print("=" * 60)


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else TOTAL_REQUESTS
    concurrency = int(sys.argv[2]) if len(sys.argv) > 2 else CONCURRENCY
    if len(sys.argv) > 3:
        TARGET_URL = sys.argv[3]
    asyncio.run(run_stress_test(count, concurrency))
