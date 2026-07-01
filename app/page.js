"use client";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/tracker";
import Link from "next/link";
import Receipt from "@/components/Receipt";
import { loadMenu } from "@/lib/menu";
import {
  computeCart, validateName, validatePhone, validateQuantity, validateSelection,
  validateAddress, formatAddress, paymentConfirmation, PAYMENT_MODES, RULES, formatINR,
} from "@/lib/pricing";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function Chip({ active, onClick, children, sub }) {
  return (
    <button type="button" onClick={onClick}
      className={"text-left rounded-xl border px-3 py-2.5 transition " +
        (active ? "border-brand bg-brand/5 ring-1 ring-brand shadow-card" : "border-line bg-panel hover:border-crust")}>
      <div className="text-[13px] font-semibold leading-tight">{children}</div>
      {sub != null && <div className="text-[12px] text-muted">{sub}</div>}
    </button>
  );
}

function Field({ label, error, children, hint }) {
  return (
    <label className="block mb-3">
      <span className="text-[12px] font-semibold text-ink/80">{label}</span>
      {children}
      {error ? <span className="block text-[12px] text-brand mt-1">{error}</span>
        : hint ? <span className="block text-[12px] text-muted mt-1">{hint}</span> : null}
    </label>
  );
}

const inputCls = "mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-[14px] focus:border-brand outline-none";

export default function OrderPage() {
  const [menu, setMenu] = useState(null);
  const [source, setSource] = useState("");
  const [step, setStep] = useState("details"); // details | build | authorizing | done

  // customer + address
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState({ building: "", area: "", landmark: "", pincode: "" });
  const [geo, setGeo] = useState(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [touched, setTouched] = useState({});

  // builder (the pizza currently being composed) + cart
  const [bBase, setBBase] = useState(null);
  const [bPizza, setBPizza] = useState(null);
  const [bTopping, setBTopping] = useState(null); // null = no topping
  const [bQty, setBQty] = useState("1");
  const [cart, setCart] = useState([]);

  const [payment, setPayment] = useState("");
  const [rec, setRec] = useState({ loading: false, text: "", model: "" });
  const [confirm, setConfirm] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [authMode, setAuthMode] = useState("");

  useEffect(() => { track("LANDING_VIEWED"); loadMenu().then(({ menu, source }) => { setMenu(menu); setSource(source); }); }, []);

  const nameErr = validateName(name);
  const phoneErr = validatePhone(phone);
  const addrErr = validateAddress(address);
  const bQtyErr = validateQuantity(bQty);
  const bill = useMemo(() => computeCart(cart), [cart]);

  function setAddr(k, v) { setAddress((a) => ({ ...a, [k]: v })); }

  function detectLocation() {
    setGeoMsg("Locating…");
    if (!navigator.geolocation) { setGeoMsg("Geolocation not supported — enter address manually."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }); setGeoMsg("📍 Location pinned for the rider."); },
      () => setGeoMsg("Couldn't get location — please type your address.")
    );
  }

  async function goToBuild() {
    setTouched({ name: true, phone: true, building: true, area: true, pincode: true });
    if (nameErr || phoneErr || addrErr) return;
    await track("CUSTOMER_DETAILS_SUBMITTED", {

    customer_name: name,

    phone,

    address: formatAddress(address),

});
    setStep("build");
    await track("MENU_VIEWED");
    setRec({ loading: true, text: "", model: "" });
    try {
      const r = await fetch("/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = await r.json();
      setRec({ loading: false, text: data.recommendation || "", model: data.model || "" });
    } catch { setRec({ loading: false, text: "", model: "" }); }
  }

  function addToCart() {
    setSubmitError("");
    const e = validateSelection(bBase, "crust") || validateSelection(bPizza, "pizza") || bQtyErr;
    if (e) { setSubmitError(e); return; }
    setCart((c) => [...c, { base: bBase, pizza: bPizza, topping: bTopping, quantity: parseInt(bQty, 10) }]);
    track("ITEM_ADDED", {

    customer_name: name,

    phone,

    cart_value: computeCart([
        ...cart,
        {
            base: bBase,
            pizza: bPizza,
            topping: bTopping,
            quantity: parseInt(bQty,10),
        }
    ]).total,

    metadata: {

        pizza: bPizza.name,

        crust: bBase.name,

        topping: bTopping?.name,

        quantity: parseInt(bQty,10),

    }

});
    
    setBBase(null); setBPizza(null); setBTopping(null); setBQty("1");
  }

  function removeLine(i) { setCart((c) => c.filter((_, idx) => idx !== i)); }

  async function placeOrder() {
    setSubmitError("");
    if (cart.length === 0) { setSubmitError("Add at least one pizza to your order."); return; }
    if (!payment) { setSubmitError("Choose a payment mode."); return; }

    const finalBill = computeCart(cart);
    await track("CHECKOUT_STARTED", {

    customer_name: name,

    phone,

    address: formatAddress(address),

    cart_value: finalBill.total,

    item_count: finalBill.totalPizzas,

});

    // Simulated authorisation step for Card / UPI (no real card data).
    if (payment === "Card" || payment === "UPI") {
      setAuthMode(payment); setStep("authorizing");
      await delay(1700);
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const fullAddress = formatAddress(address);
    const items = cart.map((l) => ({
      base: l.base.name, pizza: l.pizza.name, topping: l.topping?.name || null,
      quantity: l.quantity, unit: l.base.price + l.pizza.price + (l.topping?.price || 0),
    }));
    const itemsSummary = cart.map((l) =>
      `${l.quantity}x ${l.pizza.name} on ${l.base.name}${l.topping ? " + " + l.topping.name : " (no topping)"}`).join("; ");

    let id = null, persisted = false;
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(),
          address: fullAddress, pincode: address.pincode.trim(),
          geo: geo ? `${geo.lat},${geo.lng}` : "",
          items, itemsSummary, quantity: finalBill.totalPizzas,
          subtotal: finalBill.subtotal, discount: finalBill.discount,
          gst: finalBill.gst, total: finalBill.total, payment_mode: payment,
        }),
      });
      const data = await res.json();
      id = data.id; persisted = !!data.persisted;
      await track("ORDER_PLACED", {

    customer_name: name,

    phone,

    address: formatAddress(address),

    cart_value: finalBill.total,

    item_count: finalBill.totalPizzas,

    metadata: {

        order_id: id,

        payment: payment,

    }

});
    } catch { /* keep checkout resilient */ }

    setConfirm({ id, persisted, bill: finalBill, timestamp, address: fullAddress });
    setStep("done");
  }

  function reset() {
    setStep("details"); setName(""); setPhone(""); setAddress({ building: "", area: "", landmark: "", pincode: "" });
    setGeo(null); setGeoMsg(""); setTouched({}); setCart([]); setBBase(null); setBPizza(null);
    setBTopping(null); setBQty("1"); setPayment(""); setRec({ loading: false, text: "", model: "" });
    setConfirm(null); setSubmitError(""); setAuthMode("");
  }

  const steps = ["Details", "Build", "Pay"];
  const activeIdx = step === "details" ? 0 : step === "build" ? 1 : 2;

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-paper/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-2xl tracking-tight text-brand">SliceMatic</span>
            <span className="text-[12px] text-muted hidden sm:inline">30-min delivery · New Ashok Nagar</span>
          </div>
          <Link href="/admin" className="text-[13px] text-muted hover:text-ink">Admin →</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 grid lg:grid-cols-[1.3fr_1fr] gap-8">
        <section>
          <h1 className="font-display font-extrabold text-[34px] leading-[1.05] tracking-tight">
            Build your order.<br /><span className="text-brand">Skip the phone call.</span>
          </h1>
          <p className="text-muted mt-2 mb-6 text-[15px]">Add as many pizzas as you like, see the bill build live, pay how you want.</p>

          <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={"step-dot grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold " +
                  (i <= activeIdx ? "bg-brand text-white" : "bg-line text-muted")}>{i + 1}</span>
                <span className={"text-[12px] " + (i <= activeIdx ? "text-ink font-semibold" : "text-muted")}>{s}</span>
                {i < steps.length - 1 && <span className="w-6 h-px bg-line" />}
              </div>
            ))}
          </div>

          {!menu ? (
            <div className="text-muted text-sm">Loading menu…</div>
          ) : step === "details" ? (
            <div className="bg-panel border border-line rounded-2xl p-5 shadow-card max-w-md">
              <Field label="Your name" error={touched.name ? nameErr : null}>
                <input className={inputCls} placeholder="e.g. Rajan Sharma" value={name}
                  onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
              </Field>
              <Field label="Mobile number" error={touched.phone ? phoneErr : null}>
                <input inputMode="numeric" className={inputCls} placeholder="10-digit number" value={phone}
                  onChange={(e) => setPhone(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, phone: true }))} />
              </Field>

              <div className="mt-1 mb-1 text-[12px] font-bold text-ink/70 uppercase tracking-wide">Delivery address</div>
              <Field label="Flat / building / house no." error={touched.building ? (address.building.trim().length < 2 ? "Required." : null) : null}>
                <input className={inputCls} placeholder="e.g. B-402, Lotus Apartments" value={address.building}
                  onChange={(e) => setAddr("building", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, building: true }))} />
              </Field>
              <Field label="Area / locality" error={touched.area ? (address.area.trim().length < 2 ? "Required." : null) : null}>
                <input className={inputCls} placeholder="e.g. New Ashok Nagar" value={address.area}
                  onChange={(e) => setAddr("area", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, area: true }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Landmark (optional)">
                  <input className={inputCls} placeholder="e.g. near Metro gate 3" value={address.landmark}
                    onChange={(e) => setAddr("landmark", e.target.value)} />
                </Field>
                <Field label="Pincode" error={touched.pincode && !/^[1-9][0-9]{5}$/.test(address.pincode.trim()) ? "6 digits." : null}>
                  <input inputMode="numeric" className={inputCls} placeholder="110096" value={address.pincode}
                    onChange={(e) => setAddr("pincode", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, pincode: true }))} />
                </Field>
              </div>
              <button type="button" onClick={detectLocation}
                className="text-[12px] text-brand font-semibold hover:underline mb-1">📍 Use my current location</button>
              {geoMsg && <div className="text-[12px] text-muted mb-2">{geoMsg}</div>}

              <button onClick={goToBuild}
                className="w-full mt-3 rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-3 transition">
                Continue to the menu
              </button>
            </div>
          ) : step === "build" ? (
            <div className="space-y-6 max-w-xl">
              {(rec.loading || rec.text) && (
                <div className="rounded-2xl border border-crust/60 bg-crust/10 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-branddark uppercase tracking-wide mb-1">
                    <span>✦ Picked for you</span>{rec.model && <span className="text-muted font-normal normal-case">· {rec.model}</span>}
                  </div>
                  <p className="text-[14px] text-ink/90">{rec.loading ? "Looking at what regulars near you love…" : rec.text}</p>
                </div>
              )}

              {/* Builder */}
              <div className="bg-panel border border-line rounded-2xl p-4 shadow-card">
                <div className="font-display font-bold text-lg mb-3">Compose a pizza</div>

                <div className="text-[12px] font-semibold text-ink/70 mb-1">Crust</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {menu.base.map((b) => (
                    <Chip key={b.item_code} active={bBase?.item_code === b.item_code} onClick={() => setBBase(b)} sub={formatINR(b.price)}>{b.name}</Chip>
                  ))}
                </div>

                <div className="text-[12px] font-semibold text-ink/70 mb-1">Pizza</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {menu.pizza.map((p) => (
                    <Chip key={p.item_code} active={bPizza?.item_code === p.item_code} onClick={() => setBPizza(p)} sub={formatINR(p.price)}>{p.name}</Chip>
                  ))}
                </div>

                <div className="text-[12px] font-semibold text-ink/70 mb-1">Topping <span className="text-muted font-normal">(optional)</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <Chip active={bTopping === null} onClick={() => setBTopping(null)} sub="—">No topping</Chip>
                  {menu.topping.map((t) => (
                    <Chip key={t.item_code} active={bTopping?.item_code === t.item_code} onClick={() => setBTopping(t)} sub={formatINR(t.price)}>{t.name}</Chip>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-muted">Qty</span>
                    <div className="inline-flex items-center rounded-xl border border-line overflow-hidden">
                      <button className="px-3 py-2 text-lg hover:bg-paper" onClick={() => setBQty(String(Math.max(1, (parseInt(bQty, 10) || 1) - 1)))}>−</button>
                      <input value={bQty} onChange={(e) => setBQty(e.target.value)} className="w-12 text-center py-2 outline-none text-[15px] font-semibold" inputMode="numeric" aria-label="Quantity" />
                      <button className="px-3 py-2 text-lg hover:bg-paper" onClick={() => setBQty(String(Math.min(RULES.MAX_QTY, (parseInt(bQty, 10) || 1) + 1)))}>+</button>
                    </div>
                  </div>
                  <button onClick={addToCart} className="rounded-xl bg-ink hover:bg-black text-white font-semibold px-5 py-2.5 transition">+ Add to order</button>
                </div>
                {submitError && <div className="text-[13px] text-brand mt-2">{submitError}</div>}
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div className="bg-panel border border-line rounded-2xl p-4 shadow-card">
                  <div className="font-display font-bold text-lg mb-2">Your order</div>
                  {cart.map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                      <div>
                        <div className="text-[14px] font-semibold">{l.quantity}× {l.pizza.name}</div>
                        <div className="text-[12px] text-muted">{l.base.name}{l.topping ? " · " + l.topping.name : " · no topping"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-semibold">{formatINR((l.base.price + l.pizza.price + (l.topping?.price || 0)) * l.quantity)}</span>
                        <button onClick={() => removeLine(i)} className="text-muted hover:text-brand text-lg leading-none" aria-label="Remove">×</button>
                      </div>
                    </div>
                  ))}
                  <div className="text-[12px] text-muted mt-2">
                    {bill.totalPizzas >= RULES.DISCOUNT_THRESHOLD
                      ? <span className="text-basil font-semibold">10% off applied for {bill.totalPizzas} pizzas.</span>
                      : `Add ${RULES.DISCOUNT_THRESHOLD - bill.totalPizzas} more to unlock 10% off.`}
                  </div>
                </div>
              )}

              {/* Payment */}
              <div>
                <div className="font-display font-bold text-lg mb-2">Payment</div>
                <div className="flex gap-2">
                  {PAYMENT_MODES.map((m) => (
                    <button key={m} onClick={() => setPayment(m)}
                      className={"flex-1 rounded-xl border py-2.5 text-[14px] font-semibold transition " +
                        (payment === m ? "border-brand bg-brand text-white" : "border-line bg-panel hover:border-crust")}>{m}</button>
                  ))}
                </div>
                {payment && <p className="text-[12px] text-muted mt-2">{paymentConfirmation(payment, bill.total)}{(payment === "Card" || payment === "UPI") ? " You'll authorise it on the next screen." : ""}</p>}
              </div>

              <button onClick={placeOrder}
                className="w-full rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-3.5 transition disabled:opacity-50"
                disabled={cart.length === 0}>
                {payment === "Card" || payment === "UPI" ? "Authorise & place order" : "Place order"} · {formatINR(bill.total)}
              </button>
            </div>
          ) : step === "authorizing" ? (
            <div className="bg-panel border border-line rounded-2xl p-8 shadow-card max-w-md text-center">
              <div className="spinner mx-auto mb-4" />
              <div className="font-display font-bold text-xl">Authorising your {authMode} payment…</div>
              <p className="text-muted text-[13px] mt-2">Securely confirming {formatINR(bill.total)}. This is a simulated authorisation for the demo — no real card details are collected.</p>
            </div>
          ) : (
            <div className="bg-panel border border-line rounded-2xl p-6 shadow-card max-w-md">
              <div className="w-12 h-12 rounded-full bg-basil/15 text-basil grid place-items-center text-2xl mb-3">✓</div>
              <h2 className="font-display font-extrabold text-2xl">Order placed</h2>
              <p className="text-muted text-[14px] mt-1">{paymentConfirmation(payment, confirm.bill.total)}</p>
              <p className="text-[13px] mt-3">
                {confirm.persisted
                  ? <>Saved as order <span className="font-semibold">#{confirm.id}</span>. Heading to <span className="font-semibold">{confirm.address}</span>. The kitchen is on it.</>
                  : <span className="text-muted">Order received. Delivering to {confirm.address}. (Couldn't reach the order server — your bill is on the right.)</span>}
              </p>
              <button onClick={reset} className="w-full mt-5 rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-3 transition">Start a new order</button>
            </div>
          )}

          {source === "offline" && step === "details" && (
            <p className="text-[11px] text-muted mt-6">Running in offline demo mode (menu from local fallback). Add Supabase keys to go live.</p>
          )}
        </section>

        <aside className="lg:pt-2">
          <div className="lg:sticky lg:top-24">
            <Receipt customer={name.trim()} phone={phone.trim()} address={confirm ? confirm.address : formatAddress(address)}
              bill={confirm ? confirm.bill : bill} paymentMode={payment} orderId={confirm?.id} timestamp={confirm?.timestamp} />
          </div>
        </aside>
      </div>
    </main>
  );
}
