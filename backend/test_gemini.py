"""
Standalone test — nothing to do with FastAPI or the rest of CarbonX.
This only checks one thing: can this key + base_url + model actually
reach Gemini and get a real response back? Run it directly:

    cd backend
    python test_gemini.py

Whatever it prints is the real, unfiltered error — paste that back for
help debugging, rather than digging through uvicorn's scrollback.
"""
import os
import sys
import traceback

from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
base_url = os.getenv("OPENAI_BASE_URL")
model = os.getenv("OPENAI_MODEL", "gemini-2.5-flash")

print("=" * 60)
print("CONFIG LOADED FROM .env:")
print(f"  OPENAI_API_KEY  = {api_key[:8]}...{api_key[-4:] if api_key and len(api_key) > 12 else '(too short? check this)'}" if api_key else "  OPENAI_API_KEY  = NOT SET")
print(f"  OPENAI_BASE_URL = {base_url or 'NOT SET (would call real OpenAI, not Gemini)'}")
print(f"  OPENAI_MODEL    = {model}")
print("=" * 60)

if not api_key:
    print("\n❌ STOP: OPENAI_API_KEY is not set. Check backend/.env exists and has this line.")
    sys.exit(1)

print("\nAttempting a real call to Gemini...\n")

try:
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=15.0) if base_url else OpenAI(api_key=api_key, timeout=15.0)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Reply with exactly: CarbonX AI connection successful"}],
    )
    print("✅ SUCCESS! Gemini responded:")
    print(response.choices[0].message.content)

except Exception as e:
    print("❌ FAILED. Full error details below:\n")
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
