import { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// TU PUBLIC KEY
initMercadoPago('TEST-949547b6-1065-4b13-84f1-7bf562db0b19', { locale: 'es-PE' });

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
    return new Promise((resolve, reject) => {
      fetch("http://localhost:3001/payment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      .then((response) => response.json())
      .then((data) => {
        console.log("Respuesta:", data);
        
        // Manejo de respuestas
        if (data.status === 'approved') {
            alert("✅ ¡Pago Aprobado!");
        } else if (data.status === 'pending') {
            // CASO YAPE / PAGOEFECTIVO
            alert("🎫 Código generado. Revisa tu correo o la consola para ver el CIP/QR.");
        } else {
            alert("Estado: " + data.status);
        }
        resolve();
      })
      .catch((error) => {
        console.error("Error:", error);
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