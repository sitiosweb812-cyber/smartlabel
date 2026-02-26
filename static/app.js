const resultadoDiv = document.getElementById("resultado");
let ultimoAnalisis = null;
let ultimoBarcode = null;
let imagenFrenteBase64 = null;

function comprimirImagen(base64, calidad = 0.5) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const maxWidth = 800;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const comprimida = canvas.toDataURL("image/jpeg", calidad);
            resolve(comprimida.split(",")[1]);
        };
        img.src = "data:image/jpeg;base64," + base64;
    });
}

function mostrarMensaje(texto) {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">${texto}</p>`;
}

function mostrarCargando() {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">⏳ Analizando producto...</p>`;
}

function mostrarProductoNoEncontrado() {
    imagenFrenteBase64 = null;
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `
        <div class="error-box">
            <p>😕 Este producto no está en nuestra base de datos todavía.</p>
            <p style="color:#777;font-size:0.85rem">Sacá dos fotos: el frente del producto y la tabla nutricional o lista de ingredientes. La IA lo va a analizar y agregar a la base de datos.</p>
            <div id="pasos-foto" style="width:100%;display:flex;flex-direction:column;gap:10px;">
                <div id="paso1">
                    <p style="color:#aaa;font-size:0.85rem;margin-bottom:8px;">📸 Paso 1: Foto del frente del producto</p>
                    <label class="upload-label" for="foto-frente">📷 Sacar foto del frente</label>
                    <input type="file" id="foto-frente" accept="image/*" capture="environment">
                </div>
                <div id="paso2" style="display:none;">
                    <p style="color:#00e676;font-size:0.85rem;margin-bottom:4px;">✅ Frente capturado</p>
                    <p style="color:#aaa;font-size:0.85rem;margin-bottom:8px;">📸 Paso 2: Foto de ingredientes o tabla nutricional</p>
                    <label class="upload-label" for="foto-ingredientes">📷 Sacar foto de ingredientes</label>
                    <input type="file" id="foto-ingredientes" accept="image/*" capture="environment">
                </div>
            </div>
            <button class="btn btn-secondary" onclick="reiniciar()">🔄 Escanear otro producto</button>
        </div>
    `;
    document.getElementById("foto-frente").addEventListener("change", manejarFotoFrente);
}

function manejarFotoFrente(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
        imagenFrenteBase64 = await comprimirImagen(ev.target.result.split(",")[1]);
        document.getElementById("paso2").style.display = "block";
        document.getElementById("foto-ingredientes").addEventListener("change", manejarFotoIngredientes);
    };
    reader.readAsDataURL(file);
}

function manejarFotoIngredientes(e) {
    const file = e.target.files[0];
    if (!file) return;
    mostrarCargando();
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const imagenIngredientesBase64 = await comprimirImagen(ev.target.result.split(",")[1]);
        const endpoint = ultimoBarcode ? `/agregar-producto/${ultimoBarcode}` : "/analizar-imagen";
        fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imagen_frente: imagenFrenteBase64,
                imagen_ingredientes: imagenIngredientesBase64
            })
        })
        .then(res => res.json())
        .then(data => mostrarResultado(data))
        .catch(() => mostrarMensaje("❌ Error al analizar las imágenes."));
    };
    reader.readAsDataURL(file);
}

function textoCompartir(data) {
    return `🛒 *SmartLabel - Análisis de producto*\n\n` +
        `📦 *${data.nombre}*\n` +
        `⭐ Puntuación: ${data.puntuacion}/10 | ${data.saludable}\n\n` +
        `📋 ${data.resumen}\n\n` +
        `⚠️ Alérgenos: ${data.alergenos}\n\n` +
        `💡 ${data.consejo}\n\n` +
        `_Analizado con SmartLabel_`;
}

function mostrarResultado(data) {
    if (data.error) {
        if (imagenFrenteBase64) {
            resultadoDiv.classList.remove("hidden");
            resultadoDiv.innerHTML = `
                <div class="error-box">
                    <p>❌ Error al analizar las imágenes</p>
                    <p style="color:#777;font-size:0.85rem">${data.error}</p>
                    <button class="btn btn-secondary" onclick="reiniciar()">🔄 Intentar de nuevo</button>
                </div>
            `;
        } else {
            mostrarProductoNoEncontrado();
        }
        return;
    }

    ultimoAnalisis = data;

    const badgeClass = data.saludable?.toLowerCase() === "sí" ? "si" :
                       data.saludable?.toLowerCase() === "no" ? "no" : "moderado";

    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `
        <div class="producto-nombre">${data.nombre}</div>
        <div class="fuente">Fuente: ${data.fuente}</div>
        <div class="puntuacion">
            <span class="puntaje">${data.puntuacion}/10</span>
            <span class="badge ${badgeClass}">${data.saludable}</span>
        </div>
        <div class="seccion">
            <span class="seccion-titulo">📋 Resumen</span>
            <span class="seccion-contenido">${data.resumen}</span>
        </div>
        <div class="seccion">
            <span class="seccion-titulo">⚠️ Alérgenos</span>
            <span class="seccion-contenido">${data.alergenos}</span>
        </div>
        <div class="seccion">
            <span class="seccion-titulo">🧪 Aditivos</span>
            <span class="seccion-contenido">${data.aditivos}</span>
        </div>
        <div class="seccion">
            <span class="seccion-titulo">🚫 Prohibidos en otros países</span>
            <span class="seccion-contenido">${data.prohibidos}</span>
        </div>
        <div class="seccion">
            <span class="seccion-titulo">💡 Consejo</span>
            <span class="seccion-contenido">${data.consejo}</span>
        </div>
        <div class="divider"></div>
        <div class="acciones">
            <div class="acciones-compartir">
                <button class="btn btn-whatsapp" onclick="compartirWhatsapp()">💬 WhatsApp</button>
                <button class="btn btn-telegram" onclick="compartirTelegram()">✈️ Telegram</button>
            </div>
            <button class="btn btn-primary" onclick="reiniciar()">🔄 Escanear otro producto</button>
        </div>
    `;
}

function compartirWhatsapp() {
    if (!ultimoAnalisis) return;
    const texto = encodeURIComponent(textoCompartir(ultimoAnalisis));
    window.open(`https://wa.me/?text=${texto}`, "_blank");
}

function compartirTelegram() {
    if (!ultimoAnalisis) return;
    const texto = encodeURIComponent(textoCompartir(ultimoAnalisis));
    window.open(`https://t.me/share/url?url=&text=${texto}`, "_blank");
}

function reiniciar() {
    ultimoAnalisis = null;
    ultimoBarcode = null;
    imagenFrenteBase64 = null;
    resultadoDiv.classList.add("hidden");
    resultadoDiv.innerHTML = "";
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        onScanSuccess
    );
}

function onScanSuccess(decodedText) {
    ultimoBarcode = decodedText;
    html5QrCode.stop().then(() => {
        mostrarCargando();
        fetch(`/analizar/${decodedText}`)
            .then(res => res.json())
            .then(data => mostrarResultado(data))
            .catch(() => mostrarMensaje("❌ Error al conectar con el servidor."));
    });
}

const html5QrCode = new Html5Qrcode("reader");
html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    onScanSuccess
).catch(err => {
    mostrarMensaje("❌ Error al iniciar cámara: " + err);
});
