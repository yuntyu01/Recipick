from enum import Enum

class RecipeStatus(str, Enum):
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    NOT_RECIPE = "NOT_RECIPE"