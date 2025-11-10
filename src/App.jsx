// src/App.jsx
import React, {
    useEffect,
    useState,
    useMemo,
    useRef
  } from "react";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  
  const API_URL =
    "http://177.11.209.38/vertis/VertisConnect.dll/api/V1.1/get_nfe_controle";
  
  // Helpers pra interpretar os "N"/vazio
  const isFalse = (v) =>
    v === false ||
    v === "N" ||
    v === "0" ||
    v === "NAO" ||
    v === "NÃO" ||
    v === "Nao" ||
    v === "não" ||
    v === null ||
    v === undefined ||
    v === "";
  
  // Helpers pra interpretar os "S"
  const isTrue = (v) =>
    v === true ||
    v === "S" ||
    v === "1" ||
    v === "SIM" ||
    v === "Sim" ||
    v === "sim";
  
  // Colunas da tabela, casando com o JSON
  const columns = [
    { key: "cod_unid_negoc", label: "Cód. Neg" },
    { key: "cod_unid_oper", label: "Cód. Oper." },
    { key: "nom_unid_oper", label: "Unidade" },
    { key: "nom_contato", label: "Contato" },
    { key: "tem_certificado", label: "Certificado" },
    { key: "qr_code_homologacao", label: "QRC Homologação" },
    { key: "qr_code_producao", label: "QRC Produção" },
    { key: "teste_cupom", label: "Testou Cupom" },
    { key: "teste_nfse", label: "Testou NFSe" }
  ];
  
  // função pra remover registros duplicados
  // você pode ajustar a "chave" se fizer sentido mudar
  const dedupeData = (list) => {
    const seen = new Set();
    return list.filter((row) => {
      const key = [
        row.cod_unid_negoc,
        row.cod_unid_oper,
        row.nom_unid_oper,
        row.nom_contato
      ]
        .map((v) => (v ?? "").toString().trim())
        .join("|");
  
      if (seen.has(key)) {
        return false; // ignora duplicado
      }
      seen.add(key);
      return true;
    });
  };
  
  function App() {
    const [data, setData] = useState([]);
    const [sortedBy, setSortedBy] = useState({
      key: "cod_unid_negoc",
      direction: "asc"
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
  
    // filtros
    const [clientFilter, setClientFilter] = useState("");
    const [contactFilter, setContactFilter] = useState("");
  
    // paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // 10 / 25 / 50
  
    // flag pra garantir que o fetch só rode 1x (mesmo com StrictMode)
    const hasFetchedRef = useRef(false);
  
    useEffect(() => {
      if (hasFetchedRef.current) {
        return; // já buscou, não faz de novo
      }
      hasFetchedRef.current = true;
  
      const fetchData = async () => {
        try {
          setLoading(true);
          setError("");
  
          const response = await fetch(API_URL);
          if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
          }
  
          const json = await response.json();
          const list = Array.isArray(json) ? json : [];
  
          // deduplicar dados
          const deduped = dedupeData(list);
  
          // logs opcionais pra conferir
          console.log("Total recebido da API:", list.length);
          console.log("Total após dedupe:", deduped.length);
  
          setData(deduped);
        } catch (err) {
          console.error(err);
          setError(err.message || "Erro ao carregar dados.");
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
    }, []);
  
    const originalTotal = data.length || 0;
  
    // Normalização para busca (case + acentos)
    const normalize = (val) =>
      (val ?? "")
        .toString()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
  
    // Aplica filtros de cliente e contato
    const filteredData = useMemo(() => {
      if (!data.length) return [];
  
      const clientTerm = normalize(clientFilter);
      const contactTerm = normalize(contactFilter);
  
      return data.filter((row) => {
        const cliente1 = normalize(row.nom_unid_negoc);  // possível nome de cliente
        const cliente2 = normalize(row.nom_unid_negoce); // var legacy
        const unidadeOp = normalize(row.nom_unid_oper);  // unidade atual
        const contato = normalize(row.nom_contato);
  
        const matchClient = clientTerm
          ? cliente1.includes(clientTerm) ||
            cliente2.includes(clientTerm) ||
            unidadeOp.includes(clientTerm)
          : true;
  
        const matchContact = contactTerm ? contato.includes(contactTerm) : true;
  
        return matchClient && matchContact;
      });
    }, [data, clientFilter, contactFilter]);
  
    const totalFiltrado = filteredData.length || 0;
  
    // sempre que filtro ou page size mudar, volta pra página 1
    useEffect(() => {
      setCurrentPage(1);
    }, [clientFilter, contactFilter, itemsPerPage]);
  
    // Cálculos dos widgets (baseados nos dados filtrados)
    const stats = useMemo(() => {
      if (!totalFiltrado) {
        return {
          comCertificado: 0,
          comQrcHom: 0,
          comQrcProd: 0,
          testouCupom: 0,
          testouNFSe: 0
        };
      }
  
      const comCertificado = filteredData.filter((row) =>
        isTrue(row.tem_certificado)
      ).length;
  
      const comQrcHom = filteredData.filter((row) =>
        isTrue(row.qr_code_homologacao)
      ).length;
  
      const comQrcProd = filteredData.filter((row) =>
        isTrue(row.qr_code_producao)
      ).length;
  
      const testouCupom = filteredData.filter((row) =>
        isTrue(row.teste_cupom)
      ).length;
  
      const testouNFSe = filteredData.filter((row) =>
        isTrue(row.teste_nfse)
      ).length;
  
      return {
        comCertificado,
        comQrcHom,
        comQrcProd,
        testouCupom,
        testouNFSe
      };
    }, [filteredData, totalFiltrado]);
  
    const getPercent = (value) =>
      totalFiltrado
        ? ((value / totalFiltrado) * 100).toFixed(1).replace(".", ",")
        : "0,0";
  
    // Ordenação (em cima dos dados filtrados)
    const sortedData = useMemo(() => {
      if (!filteredData.length) return [];
  
      const sorted = [...filteredData].sort((a, b) => {
        const { key, direction } = sortedBy;
        const valA = a[key];
        const valB = b[key];
  
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
  
        const numA = Number(valA);
        const numB = Number(valB);
        let comparison = 0;
  
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          comparison = numA - numB;
        } else {
          comparison = String(valA).localeCompare(String(valB), "pt-BR", {
            numeric: true,
            sensitivity: "base"
          });
        }
  
        return direction === "asc" ? comparison : -comparison;
      });
  
      return sorted;
    }, [filteredData, sortedBy]);
  
    // paginação em cima do sortedData
    const totalItens = sortedData.length;
    const totalPaginas =
      totalItens > 0 ? Math.ceil(totalItens / itemsPerPage) : 1;
  
    // currentPage "seguro" só para cálculo, sem mexer no state
    const currentPageSafe = Math.min(
      Math.max(currentPage, 1),
      totalPaginas || 1
    );
  
    const startIndex = (currentPageSafe - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData =
      totalItens > 0 ? sortedData.slice(startIndex, endIndex) : [];
  
    // Handlers
    const handleSort = (key) => {
      setSortedBy((prev) => {
        if (prev.key === key) {
          return {
            key,
            direction: prev.direction === "asc" ? "desc" : "asc"
          };
        }
        return { key, direction: "asc" };
      });
    };
  
    const sortIcon = (key) => {
      if (sortedBy.key !== key) return "⇅";
      return sortedBy.direction === "asc" ? "↑" : "↓";
    };
  
    const handleExportPDF = () => {
      if (!sortedData.length) return;
  
      const doc = new jsPDF("landscape");
      doc.setFontSize(16);
      doc.text("Relatório NFe Controle | Vertis", 14, 18);
  
      const head = [columns.map((col) => col.label)];
      const body = sortedData.map((row) =>
        columns.map((col) => {
          const value = row[col.key];
          if (typeof value === "boolean") return value ? "Sim" : "Não";
          if (value === "S") return "Sim";
          if (value === "N") return "Não";
          return value != null ? String(value) : "";
        })
      );
  
      doc.autoTable({
        head,
        body,
        startY: 24,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 106, 0] }
      });
  
      doc.save("relatorio-nfe-controle.pdf");
    };
  
    const handleClearFilters = () => {
      setClientFilter("");
      setContactFilter("");
    };
  
    const handleChangeItemsPerPage = (e) => {
      const value = Number(e.target.value);
      if ([10, 25, 50].includes(value)) {
        setItemsPerPage(value);
      }
    };
  
    const handleGoToPage = (page) => {
      setCurrentPage(page);
    };
  
    const handlePrevPage = () => {
      setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
    };
  
    const handleNextPage = () => {
      setCurrentPage((prev) =>
        prev < totalPaginas ? prev + 1 : prev
      );
    };
  
    // gera lista [1, 2, 3, ..., totalPaginas] pra paginação
    const pageNumbers = Array.from(
      { length: totalPaginas },
      (_, idx) => idx + 1
    );
  
    return (
      <div className="app-container">
        {/* Cabeçalho */}
        <header className="app-header">
          <div className="logo-area">
            <img
              src="https://v1.laudosonline.com.br/assets/images/logo-primary-white.png"
              alt="Vertis"
              className="logo-img"
            />
            <div className="logo-text">
              <span className="logo-subtitle">NFe | Painel de Controle</span>
            </div>
          </div>
  
          <button className="pdf-button" onClick={handleExportPDF}>
            Exportar tabela em PDF
          </button>
        </header>
  
        <main className="app-main">
          {/* FILTROS */}
          <section className="filters-bar">
            <div className="filter-group">
              <label className="filter-label">Filtrar por cliente</label>
              <input
                type="text"
                className="filter-input"
                placeholder="Digite o nome do cliente/unidade..."
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>
  
            <div className="filter-group">
              <label className="filter-label">Filtrar por contato</label>
              <input
                type="text"
                className="filter-input"
                placeholder="Digite o nome do contato..."
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
              />
            </div>
  
            <div className="filters-actions">
              <button
                type="button"
                className="clear-filters-btn btn btn-outline-secondary btn-sm"
                onClick={handleClearFilters}
                disabled={!clientFilter && !contactFilter}
              >
                Limpar filtros
              </button>
            </div>
          </section>
  
          {loading && <div className="status-badge loading">Carregando...</div>}
          {error && (
            <div className="status-badge error">
              Erro ao carregar dados: {error}
            </div>
          )}
  
          {!loading && !error && (
            <>
              {/* WIDGETS */}
              <section className="widgets-grid">
                <Widget
                  title="Certificado"
                  value={stats.comCertificado}
                  total={totalFiltrado}
                  percent={getPercent(stats.comCertificado)}
                />
                <Widget
                  title="QR CODE | Homologação"
                  value={stats.comQrcHom}
                  total={totalFiltrado}
                  percent={getPercent(stats.comQrcHom)}
                />
                <Widget
                  title="QR CODE | Produção"
                  value={stats.comQrcProd}
                  total={totalFiltrado}
                  percent={getPercent(stats.comQrcProd)}
                />
                <Widget
                  title="NFCe | Teste"
                  value={stats.testouCupom}
                  total={totalFiltrado}
                  percent={getPercent(stats.testouCupom)}
                />
                <Widget
                  title="NFe | Teste"
                  value={stats.testouNFSe}
                  total={totalFiltrado}
                  percent={getPercent(stats.testouNFSe)}
                />
              </section>
  
              {/* TABELA */}
              <section className="table-card">
                <div className="table-header">
                  <h2>Controle de NFe</h2>
                  <span className="table-total">
                    Itens nesta página: <strong>{paginatedData.length}</strong> ·{" "}
                    Filtrados: <strong>{totalItens}</strong> · Total geral:{" "}
                    <strong>{originalTotal}</strong>
                  </span>
                </div>
  
                <div className="table-wrapper">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className="sortable"
                            style={{ cursor: "pointer" }}
                          >
                            <span>{col.label}</span>
                            <span className="sort-icon ms-1">
                              {sortIcon(col.key)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {totalItens === 0 && (
                        <tr>
                          <td colSpan={columns.length} className="empty-state">
                            Nenhum registro encontrado com os filtros atuais.
                          </td>
                        </tr>
                      )}
                      {totalItens > 0 &&
                        paginatedData.map((row, idx) => (
                          <tr key={`${row.cod_unid_negoc}-${row.cod_unid_oper}-${idx}`}>
                            {columns.map((col) => {
                              const value = row[col.key];
                              let display = value;
  
                              if (typeof value === "boolean") {
                                display = value ? "Sim" : "Não";
                              } else if (value === "S") {
                                display = "Sim";
                              } else if (value === "N") {
                                display = "Não";
                              }
  
                              return <td key={col.key}>{display}</td>;
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
  
                {/* RODAPÉ: Itens por página + paginação Bootstrap */}
                {totalItens > 0 && (
                  <div className="table-footer-row mt-2 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                    <div className="page-size d-flex align-items-center gap-2">
                      <span className="page-size-label">Itens por página:</span>
                      <select
                        className="page-size-select form-select form-select-sm"
                        style={{ width: "auto" }}
                        value={itemsPerPage}
                        onChange={handleChangeItemsPerPage}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
  
                    <nav
                      aria-label="Navegação de páginas"
                      className="mt-1 mt-md-0"
                    >
                      <ul className="pagination pagination-sm mb-0">
                        <li
                          className={`page-item ${
                            currentPageSafe === 1 ? "disabled" : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={handlePrevPage}
                            type="button"
                          >
                            Anterior
                          </button>
                        </li>
  
                        {pageNumbers.map((page) => (
                          <li
                            key={page}
                            className={`page-item ${
                              page === currentPageSafe ? "active" : ""
                            }`}
                          >
                            <button
                              className="page-link"
                              type="button"
                              onClick={() => handleGoToPage(page)}
                            >
                              {page}
                            </button>
                          </li>
                        ))}
  
                        <li
                          className={`page-item ${
                            currentPageSafe === totalPaginas ? "disabled" : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={handleNextPage}
                            type="button"
                          >
                            Próxima
                          </button>
                        </li>
                      </ul>
                    </nav>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    );
  }
  
  function Widget({ title, value, total, percent }) {
    return (
      <article className="widget-card">
        <h3>{title}</h3>
        <p className="widget-main-number">
          {value} <span className="widget-total">/ {total}</span>
        </p>
        <p className="widget-percent">{percent}% dos registros</p>
        <div className="widget-bar">
          <div
            className="widget-bar-fill"
            style={{
              width: total ? `${(value / total) * 100}%` : "0%"
            }}
          />
        </div>
      </article>
    );
  }
  
  export default App;
  