import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatDa as formatDaWeb } from "@/lib/currency";

// formatDa()'s fr-FR thousands separator is a narrow no-break space
// (U+202F, with plain no-break space U+00A0 also possible depending on ICU
// data) -- react-pdf's base Helvetica font (WinAnsiEncoding, no font
// fallback) has no glyph for either and silently renders "/" instead
// ("1 200,00" -> "1/200,00"). Swap both for a plain space in the PDF only;
// the web UI keeps the nicer non-breaking version since browsers render it
// fine. Built via fromCharCode (not a literal in source) to avoid any
// ambiguity about which invisible character ends up in this file.
const NON_BREAKING_SPACES = [0x00a0, 0x202f].map((code) => String.fromCharCode(code));

function formatDa(centimes: number): string {
  return NON_BREAKING_SPACES.reduce((text, char) => text.split(char).join(" "), formatDaWeb(centimes));
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  block: { width: "48%" },
  blockTitle: { fontWeight: 700, marginBottom: 4 },
  line: { marginBottom: 2 },
  table: { marginTop: 8, borderTop: "1pt solid #000", borderBottom: "1pt solid #000" },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1pt solid #000", paddingVertical: 4, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottom: "0.5pt solid #ccc" },
  colDesc: { width: "34%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colTva: { width: "10%", textAlign: "right" },
  colAmount: { width: "20%", textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalsRowBold: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, fontWeight: 700, borderTop: "1pt solid #000", paddingTop: 4 },
  words: { marginTop: 24, fontStyle: "italic" },
  footer: { marginTop: 40 },
});

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: string;
  seller: {
    name: string;
    nif: string;
    nis: string;
    rc: string;
    ai: string | null;
    address: string | null;
  };
  buyer: {
    name: string;
    address: string | null;
    nif: string | null;
  };
  items: {
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    tvaRate: number;
    amountHt: number;
  }[];
  subtotal: number;
  discountAmount: number;
  tvaDetails: Record<string, number>;
  tvaAmount: number;
  taxStampAmount: number;
  totalTtc: number;
  netToPay: number;
  amountInWords: string;
  paymentTerms: string | null;
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FACTURE N° {data.invoiceNumber}</Text>
        <Text style={styles.subtitle}>Date : {data.issueDate}</Text>

        <View style={styles.row}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Fournisseur</Text>
            <Text style={styles.line}>{data.seller.name}</Text>
            <Text style={styles.line}>NIF : {data.seller.nif}</Text>
            <Text style={styles.line}>NIS : {data.seller.nis}</Text>
            <Text style={styles.line}>RC : {data.seller.rc}</Text>
            {data.seller.ai && <Text style={styles.line}>AI : {data.seller.ai}</Text>}
            {data.seller.address && <Text style={styles.line}>{data.seller.address}</Text>}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Client</Text>
            <Text style={styles.line}>{data.buyer.name}</Text>
            {data.buyer.nif && <Text style={styles.line}>NIF : {data.buyer.nif}</Text>}
            {data.buyer.address && <Text style={styles.line}>{data.buyer.address}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDesc}>Désignation</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>Unité</Text>
            <Text style={styles.colPrice}>P.U. HT</Text>
            <Text style={styles.colTva}>TVA</Text>
            <Text style={styles.colAmount}>Montant HT</Text>
          </View>
          {data.items.map((item) => (
            <View style={styles.tableRow} key={item.lineNumber}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatDa(item.unitPrice)}</Text>
              <Text style={styles.colTva}>{item.tvaRate}%</Text>
              <Text style={styles.colAmount}>{formatDa(item.amountHt)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text>Total HT</Text>
            <Text>{formatDa(data.subtotal)}</Text>
          </View>
          {data.discountAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text>Remise</Text>
              <Text>-{formatDa(data.discountAmount)}</Text>
            </View>
          )}
          {Object.entries(data.tvaDetails).map(([rate, amount]) => (
            <View style={styles.totalsRow} key={rate}>
              <Text>TVA {rate}%</Text>
              <Text>{formatDa(amount)}</Text>
            </View>
          ))}
          <View style={styles.totalsRowBold}>
            <Text>Total TTC</Text>
            <Text>{formatDa(data.totalTtc)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Droit de timbre</Text>
            <Text>{formatDa(data.taxStampAmount)}</Text>
          </View>
          <View style={styles.totalsRowBold}>
            <Text>Net à payer</Text>
            <Text>{formatDa(data.netToPay)}</Text>
          </View>
        </View>

        <Text style={styles.words}>Arrêtée la présente facture à la somme de : {data.amountInWords}</Text>

        <View style={styles.footer}>
          <Text>Conditions de paiement : {data.paymentTerms ?? "À réception"}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
