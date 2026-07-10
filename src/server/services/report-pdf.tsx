import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 4 },
  filters: { fontSize: 9, color: "#555", marginBottom: 16 },
  table: { marginTop: 8, borderTop: "1pt solid #000", borderBottom: "1pt solid #000" },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1pt solid #000", paddingVertical: 4, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottom: "0.5pt solid #ccc" },
  cell: { flex: 1, paddingRight: 4 },
  cellRight: { flex: 1, paddingRight: 4, textAlign: "right" },
  totalsRow: { flexDirection: "row", marginTop: 8, paddingTop: 4, borderTop: "1pt solid #000", fontWeight: 700 },
});

export interface ReportPdfColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface ReportPdfData {
  title: string;
  subtitle?: string;
  filterSummary?: string;
  columns: ReportPdfColumn[];
  rows: Record<string, string | number>[];
  totalsRow?: Record<string, string | number>;
}

function ReportDocument({ data }: { data: ReportPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        {data.subtitle && <Text style={styles.subtitle}>{data.subtitle}</Text>}
        {data.filterSummary && <Text style={styles.filters}>{data.filterSummary}</Text>}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {data.columns.map((col) => (
              <Text key={col.key} style={col.align === "right" ? styles.cellRight : styles.cell}>
                {col.label}
              </Text>
            ))}
          </View>
          {data.rows.map((row, i) => (
            <View style={styles.tableRow} key={i}>
              {data.columns.map((col) => (
                <Text key={col.key} style={col.align === "right" ? styles.cellRight : styles.cell}>
                  {row[col.key] ?? ""}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {data.totalsRow && (
          <View style={styles.totalsRow}>
            {data.columns.map((col) => (
              <Text key={col.key} style={col.align === "right" ? styles.cellRight : styles.cell}>
                {data.totalsRow?.[col.key] ?? ""}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />);
}
