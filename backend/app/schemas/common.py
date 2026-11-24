from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# Whitespace is trimmed before length checks, so "   " is rejected as empty.
Text80 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Text40 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Text120 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Note140 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=140)]


class StrictModel(BaseModel):
    """Request bodies refuse unknown fields, so a typo is an error rather than silently ignored."""

    model_config = ConfigDict(extra="forbid")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
