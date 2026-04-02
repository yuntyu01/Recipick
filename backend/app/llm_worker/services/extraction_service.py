import os
import json
import uuid
import time
import boto3
import requests
# import yt_dlp
from google.genai import types
from google import genai
from app.shared.repositories import recipe_repo
from app.shared.config import settings
from app.shared.utils import recipe_normalizer

RECIPE_SCHEMA = {
  "type": "object",
  "properties": {
    "is_recipe": {"type": "boolean"},
    "category": {"type": "string"},
    "difficulty": {"type": "string"},
    "servings": {"type": "number"},
    "total_calorie": {"type": "number"},
    "total_estimated_price": {"type": "number"},
    "nutrition_details": {
      "type": "object",
      "properties": {
        "carbs_g": {"type": "number"},
        "protein_g": {"type": "number"},
        "fat_g": {"type": "number"},
        "sodium_mg": {"type": "number"},
        "sugar_g": {"type": "number"}
      },
      "required": ["carbs_g","protein_g","fat_g","sodium_mg","sugar_g"]
    },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "normalized_names": {
            "type": "array",
            "items": {"type": "string"}
          },
          "amount": {"type": "string"},
          "estimated_price": {"type": "number"},
          "alternatives": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "amount": {"type": "string"},
                "estimated_price": {"type": "number"}
              },
              "required": ["name","amount","estimated_price"]
            }
          }
        },
        "required": ["name","normalized_names","amount","estimated_price","alternatives"]
      }
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "step": {"type": "number"},
          "desc": {"type": "string"},
          "timer_sec": {"type": "number"},
          "video_timestamp": {"type": "string"},
          "ingredients_used": {
            "type": "array",
            "items": {"type": "string"}
          }
        },
        "required": ["step","desc","timer_sec","video_timestamp","ingredients_used"]
      }
    }
  },
  "required": ["is_recipe","category","difficulty","servings","total_calorie","total_estimated_price","nutrition_details","ingredients","steps"]
}

# Gemini API 설정 (환경변수에서 키를 가져옴)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def run_etl_pipeline(video_id: str, original_url: str):
    yt_url = original_url or f"https://www.youtube.com/watch?v={video_id}"


    # 프롬프트: 스키마를 강제하는 프롬프트 엔지니어링
    prompt = """
    너는 전문 요리 영상 분석가이자 데이터 엔지니어보조야. 
    제공된 영상을 분석하여 정확한 레시피 데이터를 추출하고, 아래 JSON 구조에 맞춰 응답해.

    [분석 단계]
    1. 요리 여부 확인: 영상에 구체적인 요리 과정(재료와 조리법)이 포함되어 있는지 확인해.
        - 요리 영상이 아니면 (브이로그,순수먹방,광고 등) {"is_recipe": false}만 반환하고 종료해.
    2. 메인 레시피 선정: 한 영상에 여러 요리가 나올 경우, 비중이 가장 높거나 제목에 명시된 '메인 요리' 하나만을 기준으로 데이터를 추출해.
    
    [데이터 추출 규칙]
    - 반드시 JSON "객체" 1개만 반환해. 절대 배열([])로 감싸지 마.
    - JSON 외의 텍스트(설명, 마크다운, 코드블럭)를 절대 출력하지 마.
    1. category: '한식', '중식', '일식', '양식', '분식', '디저트' 중 적절한 것들을 선택.
    2. difficulty: '하', '중하', '중', '중상', '상' 중 선택.
    3. servings: 영상의 재료 전체 양을 보고, 일반적인 성인 기준 몇 인분인지 숫자로만 판단해 (예: 2).
    3. total_calorie: 모든 재료의 칼로리 총합을 계산하여 숫자로만 입력 (단위 제외).
    4. total_estimated_price: 모든 ingredients의 estimated_price 합계.
    5. nutrition_details: 해당 요리의 총 영양성분 추정치.
    6. ingredients:
    - name: 영상에서 언급된 '원본 식재료 이름'을 그대로 작성해 (예: 꿀꿀이 앞다리살).
    - normalized_names: 검색을 위해 '표준 명칭'을 배열 형태로 담아. 이때 대분류와 소분류가 명확히 나뉘는 식재료라면 두 가지를 모두 포함해.
      (규칙 예시 1: '앞다리살' -> ["돼지고기", "돼지 앞다리살"])
      (규칙 예시 2: '닭가슴살' -> ["닭고기", "닭가슴살"])
      (규칙 예시 3: '맛소금' -> ["소금"])
      # 주의사항: 소분류(부위) 명칭에는 반드시 어떤 고기인지(소, 돼지, 닭 등) 접두사를 붙여 고유하게 만들어야 해.
    - 각 재료의 예상 가격(estimated_price)을 포함할 것.
    - alternatives(대체재)가 있다면 이름, 양, 가격을 포함하고, 없으면 빈 배열([])로 처리.
    7. steps:
    - timer_sec: 조리 과정 중 타이머가 필요한 경우 초 단위로 입력 (없으면 0).
    - video_timestamp: 해당 과정이 시작되는 영상 내 시간 (MM:SS).
    - ingredients_used: 해당 단계에서 사용되는 재료 목록 (재료명과 양을 하나의 문자열로, 없으면 빈 배열[]). 예시: ["마늘 1스푼", "간장 2큰술"]

    [응답 JSON 구조]
    {
    "is_recipe": boolean,
    "category": "String",
    "difficulty": "String",
    "servings": Number,
    "total_calorie": Number,
    "total_estimated_price": Number,
    "nutrition_details": {
        "carbs_g": Number, "protein_g": Number, "fat_g": Number, "sodium_mg": Number, "sugar_g": Number
    },
    "ingredients": [
        {
        "name": "String", "normalized_names": ["String"], "amount": "String", "estimated_price": Number,
        "alternatives": [
            { "name": "String", "amount": "String", "estimated_price": Number }
        ]
        }
    ],
    "steps": [
        { "step": Number, "desc": "String", "timer_sec": Number, "video_timestamp": "MM:SS", "ingredients_used": ["마늘 1스푼"] }
    ]
    }
    """
    try:
        print("[INFO] Gemini 추론 시작")
        # 구조화된 JSON 응답을 강제하기 위해 response_mime_type 지정
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=types.Content(
                parts=[
                    types.Part(file_data=types.FileData(file_uri=yt_url)),
                    types.Part(text=prompt),
                ]
            ),
            config={
                "response_mime_type": "application/json",
                # 여기가 핵심: SDK가 지원하는 키로 스키마 전달
                "response_schema": RECIPE_SCHEMA,
            }
        )
        
        # 4. JSON 파싱
        extracted_data = json.loads(response.text)
        extracted_data = recipe_normalizer.normalize_recipe_types(extracted_data)

        # 요리 영상이 아닌 경우 바로 종료 (DB 상태만 변경)
        if not extracted_data.get("is_recipe", True):
            print(f"[WARN] 요리 영상이 아님 - {video_id}")
            recipe_repo.update_status(video_id, "NOT_RECIPE")
            return
        
        # 5. DB에 저장 및 상태를 COMPLETED로 변경
        recipe_repo.update_completed_recipe(video_id, extracted_data)

        # 6. 역색인(냉장고 파먹기) 업데이트 - normalized_names 중복 제거 후 처리
        all_normalized = set()
        for ingredient in extracted_data.get("ingredients", []):
            for name in ingredient.get("normalized_names", []):
                if name:
                    all_normalized.add(name)

        if all_normalized:
            recipe_repo.update_ingredient_index(video_id, list(all_normalized))
            recipe_repo.update_ingredient_counter(list(all_normalized))
            print(f"[INFO] 역색인 업데이트 완료: {all_normalized}")

        print(f"[SUCCESS] {video_id} 분석 및 DB 저장 완료")

    except json.JSONDecodeError as e:
        recipe_repo.update_status(video_id, "FAILED")
        print(f"[ERROR] Gemini raw response:\n{response.text}")
        raise
    except Exception:
        recipe_repo.update_status(video_id, "FAILED")
        print(f"[ERROR] Gemini raw response:\n{response.text}")
        raise

    