import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// 👇 1. PON AQUÍ TU PUBLIC KEY (Sácala del panel de desarrolladores)
initMercadoPago('TEST-949547b6-1065-4b13-84f1-7bf562db0b19', { locale: 'es-PE' });

function App() {
  
  const initialization = {
    amount: 250.00,
    // 👇 2. ESTE ES EL ID QUE OBTUVISTE CON CURL (Ya te lo puse aquí)
    preferenceId: '3032856182-323e1732-9583-4a47-bbc7-323c0f3ad3e9',
  };

  const customization = {
    paymentMethods: {
      creditCard: 'all',
      debitCard: 'all',
      mercadoPago: 'all',
    },
  };

  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    console.log("📤 Enviando datos al backend...", formData);
    
    // Aquí enviamos el token generado por el Brick a tu backend
    return new Promise((resolve, reject) => {
      fetch("http://localhost:3001/payment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      .then((response) => response.json())
      .then((data) => {
        console.log("✅ Respuesta del Backend:", data);
        // Si el pago es exitoso, mostramos alerta
        if(data.status === 'approved' || data.status === 'in_process'){
            alert("¡Pago Procesado Exitosamente! ID: " + data.id);
            resolve();
        } else {
            alert("El pago no fue aprobado. Estado: " + data.status);
            resolve(); // Resolvemos igual para que el brick deje de cargar
        }
      })
      .catch((error) => {
        console.error("❌ Error de red:", error);
        alert("Error al conectar con el servidor");
        reject();
      });
    });
  };

  const onError = async (error) => {
    console.log(error);
  };

  const onReady = async () => {
    console.log("Brick listo y cargado");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
      <h1>Checkout Zapatillas Nike</h1>
      <div style={{ width: '100%', maxWidth: '500px', border: '1px solid #ccc', padding: '20px', borderRadius: '10px' }}>
        <Payment
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
          onReady={onReady}
          onError={onError}
        />
      </div>
    </div>
  );
}

export default App;