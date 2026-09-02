from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey('categories.Category', on_delete=models.CASCADE, related_name='budgets')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.PositiveSmallIntegerField(validators=[MinValueValidator(2000)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-year', '-month', 'category__name']
        constraints = [models.UniqueConstraint(fields=['user', 'category', 'month', 'year'], name='unique_monthly_category_budget')]

    def __str__(self):
        return f'{self.category} — {self.month}/{self.year}'
