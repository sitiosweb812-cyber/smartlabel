const resultadoDiv = document.getElementById("resultado");

function mostrarMensaje(texto) {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">${texto}</p>`;
}

function mostrarCargando() {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="cargando">⏳ Analizando producto...</p>`;
}

function mostrarError() {
    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `<p class="error">❌ No se encontró el producto en la base de datos.</p>`;
}

function mostrarResultado(data) {
    if (data.error) {
        mostrarError();
        return;
    }

    const badgeClass = data.saludable?.toLowerCase() === "sí" ? "si" :
                       data.saludable?.toLowerCase() === "no" ? "no" : "moderado";

    resultadoDiv.classList.remove("hidden");
    resultadoDiv.innerHTML = `
        <div class="producto-nombre">${data.nombre}</div>
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
            <span class="seccion-titulo">💡 Consejo</span>
            <span class="seccion-contenido">${data.consejo}</span>
        </div>
        <button onclick="reiniciar()">Escanear otro producto</button>
    `;
}

function onScanSuccess(decodedText) {
    html5QrCode.stop().then(() => {
        mostrarCargando();
        fetch(`/analizar/${decodedText}`)
            .then(res => res.json())
            .then(data => mostrarResultado(data))
            .catch(() => mostrarError());
    });
}

function reiniciar() {
    resultadoDiv.classList.add("hidden");
    resultadoDiv.innerHTML = "";
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        onScanSuccess
    );
}

const html5QrCode = new Html5Qrcode("reader");
html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    onScanSuccess
).catch(err => {
    mostrarMensaje("❌ Error al iniciar cámara: " + err);
});
