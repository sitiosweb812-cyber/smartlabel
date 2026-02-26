from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import requests
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def obtener_producto(barcode: str):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    response = requests.get(url)
    data = response.json()
    if data.get("status") == 1:
        return data["product"]
    return None

def analizar_con_ia(producto: dict) -> dict:
    nombre = producto.get("product_name", "Desconocido")
    ingredientes = producto.get("ingredients_text", "No disponible")
    nutrientes = producto.get("nutriments", {})
    alergenos = producto.get("allergens_tags", [])
    
    alergenos_limpios = [a.replace("en:", "").replace("es:", "") for a in alergenos]

    prompt = f"""
    Sos un nutricionista argentino. Analizá este producto de forma clara y simple.

    Producto: {nombre}
    Ingredientes: {ingredientes}
    Nutrientes cada 100g:
    - Calorías: {nutrientes.get('energy-kcal_100g', 'N/D')} kcal
    - Proteínas: {nutrientes.get('proteins_100g', 'N/D')} g
    - Grasas: {nutrientes.get('fat_100g', 'N/D')} g
    - Azúcares: {nutrientes.get('sugars_100g', 'N/D')} g
    - Sodio: {nutrientes.get('sodium_100g', 'N/D')} g
    Alérgenos: {', '.join(alergenos_limpios) if alergenos_limpios else 'Ninguno detectado'}

    Respondé en español argentino con EXACTAMENTE este formato, sin agregar nada antes ni después:
    PUNTUACION: [solo un número del 1 al 10, sin texto adicional]
    SALUDABLE: [solo una de estas palabras: Sí, No, Moderado]
    RESUMEN: [2 oraciones simples explicando si es saludable y por qué]
    ALERGENOS: [lista los alérgenos separados por coma, o escribí "Ninguno detectado"]
    CONSEJO: [1 oración con una alternativa más saludable o un consejo práctico]
    """

    chat = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.1-8b-instant",
    )

    respuesta = chat.choices[0].message.content
    resultado = {}

    for linea in respuesta.strip().split("\n"):
        if ":" in linea:
            clave, valor = linea.split(":", 1)
            resultado[clave.strip()] = valor.strip()

    return {
        "nombre": nombre,
        "puntuacion": resultado.get("PUNTUACION", "N/D"),
        "saludable": resultado.get("SALUDABLE", "N/D"),
        "resumen": resultado.get("RESUMEN", "N/D"),
        "alergenos": resultado.get("ALERGENOS", "Ninguno detectado"),
        "consejo": resultado.get("CONSEJO", "N/D"),
    }

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/analizar/{barcode}")
async def analizar(barcode: str):
    producto = obtener_producto(barcode)
    if not producto:
        return {"error": "Producto no encontrado en la base de datos."}
    return analizar_con_ia(producto)