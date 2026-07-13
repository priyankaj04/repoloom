# ML Workflow Skill

This skill activates when the project depends on `torch`, `tensorflow`, `sklearn`,
`scikit-learn`, or `transformers`. Apply these rules for all ML engineering work.

## Data Contracts

Validate data schema before any training or evaluation. Never assume upstream data is
clean. Define a contract: column names, dtypes, value ranges, nullability, and class
distribution. Fail loudly with a descriptive error if the contract is violated.

```python
import pandera as pa
schema = pa.DataFrameSchema({
    "age": pa.Column(float, pa.Check.between(0, 120), nullable=False),
    "label": pa.Column(int, pa.Check.isin([0, 1])),
})
schema.validate(df)  # raises SchemaError on violation
```

## Reproducibility

Seed everything at the top of every training script. Pin all dependency versions.
A model you cannot reproduce is a liability.

```python
import random, numpy as np, torch
def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
```

Use `pip freeze > requirements.txt` or a locked `pyproject.toml`. Record the seed
value as an experiment parameter.

## Train/Val/Test Split

Split once, before any preprocessing. Store split indices or a split manifest.
Never fit any preprocessor (scaler, encoder, imputer) on validation or test data.

```python
from sklearn.model_selection import train_test_split
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42)
```

## Preprocessing Pipelines

All preprocessing must live in a `Pipeline` or `ColumnTransformer` object — not in
loose scripts or notebooks. This ensures the same transformations apply at inference.

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
pipe = Pipeline([("impute", SimpleImputer()), ("scale", StandardScaler())])
pipe.fit(X_train)
# At inference: pipe.transform(X_new)
```

## Experiment Tracking

Log every run: hyperparameters, metrics, dataset hash, and model artifact. Use MLflow
or Weights & Biases. Never rely on print statements for tracking results.

```python
import mlflow
with mlflow.start_run():
    mlflow.log_params({"lr": 1e-3, "batch_size": 32, "seed": 42})
    mlflow.log_metrics({"val_f1": f1, "val_auc": auc})
    mlflow.sklearn.log_model(model, "model")
```

## Evaluation Standards

Never report accuracy alone. Choose metrics based on task:

- Binary classification: precision, recall, F1, ROC-AUC, PR-AUC
- Multiclass: per-class F1, macro/weighted averages, confusion matrix
- Regression: MAE, RMSE, R2, residual distribution
- Ranking: nDCG, MRR

Always report metrics on the held-out test set, not validation.

## Baseline First

Build and evaluate the simplest possible model first (logistic regression, mean
predictor, rule-based system). Record baseline metrics. Do not move to complex models
until you have beaten the baseline with a meaningful margin.

## Versioned Model Artifacts

Save models with a version tag and the full experiment metadata alongside the weights.
Use MLflow Model Registry or DVC for artifact tracking. Never overwrite a model file
without archiving the previous version.

## Inference Latency

Benchmark inference latency before deployment. Measure p50, p95, and p99 on realistic
input sizes. Profile with `torch.profiler` or `cProfile`. Set a latency SLA and fail
the deployment pipeline if it is exceeded.

## Feature Drift Monitoring

In production, monitor input feature distributions against the training distribution.
Use statistical tests (KS test, PSI) on a rolling window. Alert when drift exceeds
a threshold. Retrain or roll back when drift degrades model performance.

## A/B Testing

Deploy new models via A/B test, not full cutover. Route a percentage of traffic to the
new model. Define a primary metric and minimum detectable effect upfront. Do not declare
a winner without statistical significance (p < 0.05, adequate power).
