from decimal import Decimal
from typing import Any

NUM_FIELDS_TOP = ["servings", "total_calorie", "total_estimated_price"]
NUTRI_FIELDS = ["carbs_g", "protein_g", "fat_g", "sodium_mg", "sugar_g"]

def _to_int(v: Any, default: int = 0) -> int:
    if v is None:
        return default
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int,)):
        return v
    if isinstance(v, Decimal):
        return int(v)
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        s = v.strip().replace(",", "")
        if s == "":
            return default
        # "2.0" 같은 것도 처리
        try:
            return int(float(s))
        except ValueError:
            return default
    return default

def _to_float(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    if isinstance(v, bool):
        return float(int(v))
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", "")
        if s == "":
            return default
        try:
            return float(s)
        except ValueError:
            return default
    return default

def normalize_recipe_types(data: dict) -> dict:
    # 최상위 숫자들
    for k in NUM_FIELDS_TOP:
        if k in data:
            data[k] = _to_int(data[k], 0)

    # nutrition_details
    nd = data.get("nutrition_details")
    if isinstance(nd, dict):
        for k in NUTRI_FIELDS:
            if k in nd:
                # g/mg는 정수로 둘지 float로 둘지 선택 가능
                nd[k] = _to_int(nd[k], 0)
        data["nutrition_details"] = nd

    # ingredients
    ings = data.get("ingredients")
    if isinstance(ings, list):
        for ing in ings:
            if not isinstance(ing, dict):
                continue
            if "estimated_price" in ing:
                ing["estimated_price"] = _to_int(ing["estimated_price"], 0)
            alts = ing.get("alternatives")
            if isinstance(alts, list):
                for alt in alts:
                    if isinstance(alt, dict) and "estimated_price" in alt:
                        alt["estimated_price"] = _to_int(alt["estimated_price"], 0)

    # steps
    steps = data.get("steps")
    if isinstance(steps, list):
        for st in steps:
            if not isinstance(st, dict):
                continue
            if "step" in st:
                st["step"] = _to_int(st["step"], 0)
            if "timer_sec" in st:
                st["timer_sec"] = _to_int(st["timer_sec"], 0)

    return data