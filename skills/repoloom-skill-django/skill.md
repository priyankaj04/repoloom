# Django Skill Instructions

You are working in a Django project. Apply the following patterns and practices consistently.

## Model Design — Fat Models, Thin Views

Put business logic in models and model managers, not in views or serializers.
Views should orchestrate: validate input, call a model/service method, return a response.
If a view method is longer than ~20 lines of business logic, it belongs in the model layer.

```python
# Bad: logic in view
def complete_order(request, order_id):
    order = Order.objects.get(id=order_id)
    order.status = "completed"
    order.completed_at = timezone.now()
    order.save()
    send_email(order.user.email)

# Good: logic in model
class Order(models.Model):
    def complete(self):
        self.status = "completed"
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])
        self.notify_completion()
```

## ORM — Avoid N+1 Queries

Always use `select_related` for ForeignKey/OneToOne and `prefetch_related` for ManyToMany/reverse FK.
Run queries with `connection.queries` or django-debug-toolbar to count queries before shipping.

```python
# N+1 — do NOT do this
orders = Order.objects.all()
for order in orders:
    print(order.user.email)  # 1 query per order

# Correct
orders = Order.objects.select_related("user").all()
```

Use `values()` or `values_list()` for read-only projections — skips model instantiation:

```python
emails = Order.objects.filter(status="pending").values_list("user__email", flat=True)
```

Use `annotate()` over post-processing in Python:

```python
# Bad: Python loop aggregation
orders = Order.objects.all()
total = sum(o.amount for o in orders)

# Good: push to DB
from django.db.models import Sum
total = Order.objects.aggregate(total=Sum("amount"))["total"]
```

Use `update()` for bulk field changes — one query, no model instantiation:

```python
Order.objects.filter(status="pending").update(status="expired")
```

## Migrations

Never edit a migration that has already been applied in any environment.
If you need to fix a mistake, write a new migration.

Use `RunPython` for data migrations — always provide a reverse function:

```python
def backfill_slugs(apps, schema_editor):
    Article = apps.get_model("blog", "Article")
    for article in Article.objects.filter(slug=""):
        article.slug = slugify(article.title)
        article.save(update_fields=["slug"])

def reverse_backfill(apps, schema_editor):
    pass  # irreversible data change — no-op reverse is acceptable, document why

class Migration(migrations.Migration):
    operations = [migrations.RunPython(backfill_slugs, reverse_backfill)]
```

Keep migrations small and focused. Separate schema changes from data migrations.
Name migrations descriptively: `0023_add_order_completed_at`.

## Class-Based Views and Mixins

Use CBVs for standard CRUD patterns. Compose behavior with mixins:

```python
class LoginRequiredMixin:
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(settings.LOGIN_URL)
        return super().dispatch(request, *args, **kwargs)

class OrderDetailView(LoginRequiredMixin, DetailView):
    model = Order
    queryset = Order.objects.select_related("user", "items__product")
```

Override `get_queryset()` to scope data to the current user — never trust URL kwargs blindly.

## Django REST Framework

Use `validate_<field>` for field-level validation and `validate()` for cross-field:

```python
class OrderSerializer(serializers.ModelSerializer):
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate(self, data):
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError("end_date must be after start_date.")
        return data
```

Use `SerializerMethodField` sparingly — if it touches the DB, you likely need an annotation.
Never call `.save()` in `validate()`. Keep serializers side-effect free.

## Settings Split

Maintain three settings files:

```
config/settings/
    base.py      # shared across all environments
    local.py     # dev overrides, DEBUG=True
    production.py  # prod overrides, no DEBUG
```

Use `django-environ` for secrets — never hardcode credentials:

```python
import environ
env = environ.Env()
environ.Env.read_env()

SECRET_KEY = env("SECRET_KEY")
DATABASES = {"default": env.db()}
```

## Signals — Use Sparingly

Signals make code hard to trace. Use them only for cross-app decoupling where direct calls
would create circular imports. Document every signal receiver with a comment explaining why
a direct call was not used instead.

Prefer direct method calls or service functions for same-app logic.

## Custom Managers

Use managers to encapsulate reusable query logic:

```python
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(status="published")

class Article(models.Model):
    objects = models.Manager()
    published = PublishedManager()
```

## Testing

Use `pytest-django` over `unittest.TestCase`. It is faster, composable, and has better fixtures.

```python
# conftest.py
@pytest.fixture
def user(db):
    return UserFactory()

# test_orders.py
def test_complete_order_sets_timestamp(user):
    order = OrderFactory(user=user, status="pending")
    order.complete()
    assert order.status == "completed"
    assert order.completed_at is not None
```

Use `factory_boy` for test data. Never share mutable state between tests.
Use `@pytest.mark.django_db` only on tests that hit the database — keep unit tests pure.
