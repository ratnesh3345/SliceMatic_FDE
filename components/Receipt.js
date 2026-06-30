"use client";
import { formatINR } from "@/lib/pricing";

function Row({ label, value, accent, strong }) {
  return (
    <div className="flex justify-between text-[13px]" style={{ marginBottom: 4 }}>
      <span className={accent ? "text-brand" : strong ? "font-bold" : ""}>{label}</span>
      <span className={(accent ? "text-brand " : "") + (strong ? "font-bold" : "")}>{value}</span>
    </div>
  );
}

export default function Receipt({ customer, phone, address, bill, paymentMode, orderId, timestamp }) {
  const lines = bill?.lines?.filter((l) => l.base && l.pizza) || [];
  const has = lines.length > 0;
  return (
    <div className="receipt rounded-2xl px-6 py-7 font-mono text-ink max-w-[360px] w-full mx-auto">
      <div className="text-center mb-4">
        <div className="font-display font-extrabold tracking-tight text-2xl text-brand leading-none">SLICEMATIC</div>
        <div className="text-[10px] text-muted mt-1 tracking-widest uppercase">New Ashok Nagar · Delhi</div>
      </div>

      <div className="flex justify-between text-[11px] text-muted">
        <span>{timestamp || "—"}</span>
        <span>{orderId ? `#${orderId}` : "Preview"}</span>
      </div>
      <div className="text-[11px] text-muted">{customer ? `${customer}${phone ? " · " + phone : ""}` : "Guest order"}</div>
      {address && <div className="text-[11px] text-muted mt-0.5 leading-snug">📍 {address}</div>}

      <div className="dashed my-3" />

      {!has ? (
        <div className="text-center text-muted text-[12px] py-6">
          Add a pizza and the bill will appear here, line by line.
        </div>
      ) : (
        <>
          <div className="text-[11px] font-bold text-brand uppercase tracking-wider mb-1">Order</div>
          {lines.map((l, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <div className="flex justify-between text-[13px]">
                <span>{l.qty}× {l.pizza.name}</span>
                <span>{formatINR(l.lineSubtotal)}</span>
              </div>
              <div className="text-[11px] text-muted">
                {l.base.name}{l.topping ? " · " + l.topping.name : " · no topping"} &nbsp;(@{formatINR(l.unitPrice)})
              </div>
            </div>
          ))}

          <div className="dashed my-3" />

          <Row label={`Subtotal (${bill.totalPizzas} pizza${bill.totalPizzas > 1 ? "s" : ""})`} value={formatINR(bill.subtotal)} />
          {bill.discount > 0 && <Row label="Discount (10%, 5+)" value={"−" + formatINR(bill.discount)} accent />}
          <Row label="GST (18%)" value={formatINR(bill.gst)} />

          <div className="my-3" style={{ borderTop: "3px double #d9cdbe" }} />
          <Row label="TOTAL PAYABLE" value={formatINR(bill.total)} strong />

          {paymentMode && (
            <>
              <div className="dashed my-3" />
              <Row label="Pay by" value={paymentMode} />
            </>
          )}
        </>
      )}

      <div className="text-center text-[10px] text-muted italic mt-5">
        {orderId ? "Order confirmed — thank you!" : "Live preview"}
      </div>
    </div>
  );
}
