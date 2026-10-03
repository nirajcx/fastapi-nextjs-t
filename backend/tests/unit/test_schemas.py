"""Fast schema tests do not require PostgreSQL."""

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest
from app.schemas.todos import TodoCreate, TodoUpdate
from app.schemas.users import UserUpdate


def test_email_normalization_and_password_not_trimmed():
    payload = RegisterRequest(
        email="Learner@Example.COM",
        display_name="  Learner  ",
        password="  twelve-chars-password  ",
    )
    assert payload.email == "learner@example.com"
    assert payload.display_name == "Learner"
    assert payload.password.get_secret_value() == "  twelve-chars-password  "
    assert "twelve-chars" not in repr(payload)


@pytest.mark.parametrize(
    "payload",
    [{"title": "   "}, {"title": "X", "owner_id": "forged"}, {"title": "X", "tenant_id": "forged"}],
)
def test_create_rejects_blank_and_ownership(payload):
    with pytest.raises(ValidationError):
        TodoCreate(**payload)


def test_patch_exercise_retains_omission_semantics():
    assert TodoUpdate(is_completed=False).model_dump(exclude_unset=True) == {"is_completed": False}
    assert TodoUpdate(description=None).model_dump(exclude_unset=True) == {"description": None}


def test_profile_rejects_blank_and_unknown_fields():
    for payload in [{"display_name": "  "}, {"display_name": "Good", "is_active": False}]:
        with pytest.raises(ValidationError):
            UserUpdate(**payload)
