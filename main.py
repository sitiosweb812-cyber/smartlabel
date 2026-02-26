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

def obtener_producto_openfoodfacts(barcode: str):
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=5)
        data = response.json()
        if data.get("status") == 1:
            return data["product"]
    except:
        pass
    return None

def obtener_producto_upc(barcode: str):
    try:
        url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
        response = requests.get(url, timeout=5)
        data = response.json()
        if data.get("code") == "OK" and data.get("items"):
            item = data["items"][0]
            return {
                "product_name": item.get("title", "Desconocido"),
                "ingredients_text": item.get("description", "No disponible"),
                "nutriments": {},
                "allergens_tags": [],
                "additives_tags": [],
                "fuente": "UPC Item DB"
            }
    except:
        pass
    return None

def obtener_producto(barcode: str):
    producto = obtener_producto_openfoodfacts(barcode)
    if producto:
        producto["fuente"] = "Open Food Facts"
        return producto

    producto = obtener_producto_upc(barcode)
    if producto:
        return producto

    return None

def analizar_con_ia(producto: dict) -> dict:
    nombre = producto.get("product_name", "Desconocido")
    ingredientes = producto.get("ingredients_text", "No disponible")
    nutrientes = producto.get("nutriments", {})
    alergenos = producto.get("allergens_tags", [])
    aditivos = producto.get("additives_tags", [])
    fuente = producto.get("fuente", "Desconocido")

    alergenos_limpios = [a.replace("en:", "").replace("es:", "") for a in alergenos]
    aditivos_limpios = [a.replace("en:", "") for a in aditivos]

    prompt = f"""
    Sos un nutricionista y toxicólogo argentino experto en seguridad alimentaria. Analizá este producto de forma clara y simple.

    Producto: {nombre}
    Ingredientes: {ingredientes}
    Nutrientes cada 100g:
    - Calorías: {nutrientes.get('energy-kcal_100g', 'N/D')} kcal
    - Proteínas: {nutrientes.get('proteins_100g', 'N/D')} g
    - Grasas: {nutrientes.get('fat_100g', 'N/D')} g
    - Azúcares: {nutrientes.get('sugars_100g', 'N/D')} g
    - Sodio: {nutrientes.get('sodium_100g', 'N/D')} g
    Alérgenos: {', '.join(alergenos_limpios) if alergenos_limpios else 'Ninguno detectado'}
    Aditivos: {', '.join(aditivos_limpios) if aditivos_limpios else 'Ninguno detectado'}

    Respondé en español argentino con EXACTAMENTE este formato, sin agregar nada antes ni después:
    PUNTUACION: [solo un número del 1 al 10, sin texto adicional]
    SALUDABLE: [solo una de estas palabras: Sí, No, Moderado]
    RESUMEN: [2 oraciones simples explicando si es saludable y por qué]
    ALERGENOS: [lista los alérgenos o "Ninguno detectado"]
    CONSEJO: [1 oración con una alternativa más saludable o un consejo práctico]
    ADITIVOS: [si hay aditivos, explicá cada uno con este formato: "Nombre (código): para qué sirve y si es seguro". Si no hay escribí "Ninguno detectado"]
    PROHIBIDOS: [mencioná si algún ingrediente o aditivo está prohibido o restringido en EEUU, Europa o Japón por ser cancerígeno o dañino, indicando en qué países y por qué. Si ninguno está prohibido escribí "Ninguno detectado"]
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
        "fuente": fuente,
        "puntuacion": resultado.get("PUNTUACION", "N/D"),
        "saludable": resultado.get("SALUDABLE", "N/D"),
        "resumen": resultado.get("RESUMEN", "N/D"),
        "alergenos": resultado.get("ALERGENOS", "Ninguno detectado"),
        "consejo": resultado.get("CONSEJO", "N/D"),
        "aditivos": resultado.get("ADITIVOS", "Ninguno detectado"),
        "prohibidos": resultado.get("PROHIBIDOS", "Ninguno detectado"),
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
