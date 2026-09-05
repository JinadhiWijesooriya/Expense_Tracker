from django.urls import path

from .views import (
    CategoryReportView,
    MonthlyReportExportView,
    MonthlyReportPDFExportView,
    MonthlyReportView,
)

urlpatterns = [
    path('monthly/', MonthlyReportView.as_view()),
    path('categories/', CategoryReportView.as_view()),
    path('download/', MonthlyReportExportView.as_view()),
    path('download-pdf/', MonthlyReportPDFExportView.as_view()),
]
