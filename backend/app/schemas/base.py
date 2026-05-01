"""
Base schemas for API responses.
Provides generic response wrappers.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """
    Generic API response wrapper.
    """

    success: bool = True
    data: T
    message: str | None = None
