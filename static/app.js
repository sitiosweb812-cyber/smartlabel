const resultadoDiv = document.getElementById("resultado");
let ultimoAnalisis = null;

function mostrarMensaje(texto) {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">${texto}</p>`;
}

function mostrarCargando() {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">⏳ Analizando producto...</p>`;
}

function mostrarProductoNoEncontrado() {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `
        <div class="error-box">
            <p>😕 Este producto no está en nuestra base de datos todavía.</p>
            <p style="color:#777;font-size:0.85rem">Podés fotografiar la etiqueta y la IA va a intentar analizarlo igual.</p>
            <label class="upload-label" for="foto-etiqueta">📷 Fotografiar etiqueta</label>
            <input type="file" id="foto-etiqueta" accept="image/*" capture="environment">
            <button class="btn btn-secondary" onclick="reiniciar()">🔄 Escanear otro producto</button>
        </div>
    `;
    document.getElementById("foto-etiqueta").addEventListener("change", manejarFotoEtiqueta);
}

function manejarFotoEtiqueta(e) {
    const file = e.target.files[0];
    if (!file) return;
    mostrarCargando();
    const reader = new FileReader();
    reader.onload = function(ev) {
        const base64 = ev.target.result.split(",")[1];
        fetch("/analizar-imagen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagen: base64 })
        })
        .then(res => res.json())
        .then(data => mostrarResultado(data))
        .catch(() => mostrarMensaje("❌ Error al analizar la imagen."));
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
        mostrarProductoNoEncontrado();
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
    resultadoDiv.classList.add("hidden");
    resultadoDiv.innerHTML = "";
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        onScanSuccess
    );
}

function onScanSuccess(decodedText) {
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
