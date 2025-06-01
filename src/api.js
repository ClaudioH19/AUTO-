// src/api.js
export async function enviarCredencialesWiFi(baseUrl, ssid, password) {
  const res = await fetch(`${baseUrl}/config_wifi`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // o 'text/plain'
    body: JSON.stringify({ ssid, pass: password }),
  });

    if (!res.ok) {
        throw new Error(`Error al enviar las credenciales: ${res.statusText}`);
    }
    if (res.status === 204) {
        return { success: true, message: 'Credenciales enviadas correctamente' };
    }
    const data = await res.json();
    if (data.error) {
        throw new Error(`Error: ${data.error}`);
    }
    if (data.success) {
        return { success: true, message: 'Credenciales enviadas correctamente' };
    }
    if (data.message) {
        return { success: true, message: data.message };
    }
  return res;
}

export async function resetearWiFi(baseUrl) {
  return fetch(`${baseUrl}/reset_wifi`);
}

export async function obtenerEstado(baseUrl) {
  const res = await fetch(`${baseUrl}/status`);
  return res.json();
}