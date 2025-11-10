// api/nfe.js
export default async function handler(req, res) {
    const upstreamUrl =
      "http://177.11.209.38/vertis/VertisConnect.dll/api/V1.1/get_nfe_controle";
  
    try {
      const response = await fetch(upstreamUrl);
  
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: `Erro na API upstream: ${response.status}` });
      }
  
      const data = await response.json();
  
      // Se quiser, pode logar algo pra debug:
      // console.log("Registros recebidos da API upstream:", data.length);
  
      // Aqui devolvemos o JSON pro frontend
      res.status(200).json(data);
    } catch (err) {
      console.error("Erro ao chamar upstream:", err);
      res.status(500).json({ error: "Erro ao consultar API de NFe" });
    }
  }
  