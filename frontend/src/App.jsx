import { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// TU PUBLIC KEY
const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
initMercadoPago(publicKey, { locale: 'es-PE' });
function App() {
  const [preferenceId, setPreferenceId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generar preferencia dinámicamente al cargar
    fetch('http://localhost:3001/payment/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            title: 'Producto de prueba',
            quantity: 1,
            unit_price: 250.00,
            currency_id: 'PEN'
          }
        ],
        orderId: `ORDER-${Date.now()}`,
        customerEmail: 'test@test.com'
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Preference ID generado:', data.preferenceId);
      setPreferenceId(data.preferenceId);
      setLoading(false);
    })
    .catch(err => {
      console.error('❌ Error creando preferencia:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando métodos de pago...</div>;
  }

  if (!preferenceId) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Error al cargar. Revisa la consola.</div>;
  }

  const initialization = {
    amount: 250.00,
    preferenceId: preferenceId,
  };

  const customization = {
    paymentMethods: {
     creditCard: "all",
      debitCard: "all",
      ticket: "all",         // Activa PagoEfectivo (códigos CIP)
      bankTransfer: "all",   // Activa Yape/Plin (QR)
     mercadoPago: "all",    // Billetera MP
    },
  };

  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    console.log("📤 Datos crudos del Brick:", formData);

    // 1. Mapeamos los datos de snake_case a camelCase para el Backend
    // y agregamos el orderId que falta.
    const backendData = {
      token: formData.token,
      paymentMethodId: formData.payment_method_id, // Traducción clave
      transactionAmount: formData.transaction_amount, // Traducción clave
      installments: formData.installments,
      email: formData.payer.email,
      payer: formData.payer,
      orderId: "ORDER-TEST-" + Date.now(), // Generamos un ID único
    };

    return new Promise((resolve, reject) => {
      fetch("http://localhost:3001/payment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendData), // 2. Enviamos los datos corregidos
      })
      .then((response) => response.json())
      .then((data) => {
        console.log("✅ Respuesta del Backend:", data);
        
        if (data.status === 'approved' || data.status === 'in_process') {
            alert("¡Pago Procesado Exitosamente! ID: " + data.id);
        } else if (data.status === 'pending') {
             // Caso PagoEfectivo / Yape
             alert("🎫 Código generado. Revisa tu consola para ver los detalles.");
        } else {
            // Si el backend devuelve error controlado
            alert("Error en el pago: " + (data.message || data.status));
        }
        resolve();
      })
      .catch((error) => {
        console.error("❌ Error de red:", error);
        reject();
      });
    });
  };
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
      <div style={{ width: '500px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Prueba Yape / PagoEfectivo</h2>
        <Payment
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

export default App;