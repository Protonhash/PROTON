use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use flate2::write::DeflateEncoder;
use flate2::Compression;
use std::io::Write;
use std::time::Instant;

#[derive(Deserialize, Clone)]
pub struct Task {
    pub task_id: i64,
    #[serde(rename = "type")]
    pub task_type: String,
    pub difficulty: u8,
    pub nonce: String,
    pub payload: serde_json::Value,
    pub timeout_ms: u64,
}

#[derive(Serialize)]
pub struct TaskResult {
    pub task_id: i64,
    pub result: serde_json::Value,
    pub compute_time_ms: u64,
}

pub fn execute_task(task: &Task) -> TaskResult {
    let start = Instant::now();

    let result = match task.task_type.as_str() {
        "sha256" => compute_sha256(task),
        "vector_math" => compute_vector_math(task),
        "compression" => compute_compression(task),
        "embedding" => compute_embedding(task),
        "tensor_multiply" => compute_tensor(task),
        _ => serde_json::json!({"error": "unknown task type"}),
    };

    let elapsed = start.elapsed().as_millis() as u64;

    TaskResult {
        task_id: task.task_id,
        result,
        compute_time_ms: elapsed,
    }
}

fn compute_sha256(task: &Task) -> serde_json::Value {
    let data = task.payload["data"].as_str().unwrap_or("");
    let iterations = task.payload["iterations"].as_u64().unwrap_or(1000) as usize;

    let mut hash = data.to_string();
    for _ in 0..iterations {
        let mut hasher = Sha256::new();
        hasher.update(hash.as_bytes());
        hash = format!("{:x}", hasher.finalize());
    }

    serde_json::json!({ "hash": hash })
}

fn compute_vector_math(task: &Task) -> serde_json::Value {
    let vec_a: Vec<f64> = task.payload["vector_a"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();
    let vec_b: Vec<f64> = task.payload["vector_b"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();

    let dot_product: f64 = vec_a.iter().zip(vec_b.iter()).map(|(a, b)| a * b).sum();

    serde_json::json!({ "value": format!("{:.10}", dot_product) })
}

fn compute_compression(task: &Task) -> serde_json::Value {
    let data = task.payload["data"].as_str().unwrap_or("");
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(data.as_bytes()).unwrap_or(());
    let compressed = encoder.finish().unwrap_or_default();

    serde_json::json!({
        "compressed_size": compressed.len(),
        "original_size": data.len(),
        "ratio": if data.len() > 0 { compressed.len() as f64 / data.len() as f64 } else { 0.0 }
    })
}

fn compute_embedding(task: &Task) -> serde_json::Value {
    let tokens: Vec<u64> = task.payload["tokens"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_u64()).collect())
        .unwrap_or_default();
    let dimensions = task.payload["dimensions"].as_u64().unwrap_or(128) as usize;

    // Simulate embedding generation (deterministic based on tokens)
    let embedding: Vec<f64> = (0..dimensions)
        .map(|i| {
            let seed: f64 = tokens.iter().enumerate()
                .map(|(j, &t)| (t as f64) * ((i + j + 1) as f64).sin())
                .sum();
            seed.sin() * 0.5
        })
        .collect();

    serde_json::json!({
        "embedding": embedding,
        "dimensions": dimensions,
        "tokens_processed": tokens.len()
    })
}

fn compute_tensor(task: &Task) -> serde_json::Value {
    let dims: Vec<usize> = task.payload["dimensions"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_u64().map(|x| x as usize)).collect())
        .unwrap_or_else(|| vec![16, 16]);

    let mat_a: Vec<f64> = task.payload["matrix_a"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();
    let mat_b: Vec<f64> = task.payload["matrix_b"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();

    let n = dims[0];
    let mut result = vec![0.0f64; n * n];

    // Matrix multiplication
    for i in 0..n {
        for j in 0..n {
            let mut sum = 0.0;
            for k in 0..n {
                if let (Some(&a), Some(&b)) = (mat_a.get(i * n + k), mat_b.get(k * n + j)) {
                    sum += a * b;
                }
            }
            result[i * n + j] = sum;
        }
    }

    // Return checksum instead of full matrix
    let checksum: f64 = result.iter().sum();
    serde_json::json!({
        "checksum": checksum,
        "dimensions": dims,
        "elements_computed": n * n
    })
}
