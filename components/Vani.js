"use client";
import { useState, useRef, useEffect } from "react";

export default function Vani({ orderId, orderStatus, customerName, phone, canCancel, refundEligible }) {
  const hasContext = !!(orderId && phone);
  const [identified, setIdentified] = useState(hasContext);
  const [inputPhone, setInputPhone] = useState("");
  const [idError, setIdError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedCtx, setResolvedCtx] = useState({
    orderId: orderId || null, orderStatus: orderStatus || null,
    customerName: customerName || null, phone: phone || null,
    canCancel: canCancel || false, refundEligible: refundEligible || false,
  });
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: hasContext
      ? ("Hi " + (customerName ? customerName.split(" ")[0] : "there") + "! I'm Vani. Your order #" + orderId + " is " + (orderStatus || "placed") + ". How can I help?")
      : "Hi there! 👋 I'm **Vani**, your SliceMatic assistant. Enter your mobile number and I'll pull up your order instantly." }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(hasContext);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const QUICK = [
    { label: "📍 Where is my order?", msg: "Where is my order?" },
    { label: "❌ Cancel my order", msg: "I want to cancel my order.", onlyIf: "canCancel" },
    { label: "🔄 Request replacement", msg: "I want a replacement." },
    { label: "😞 File a complaint", msg: "I have a complaint." },
    { label: "💰 Request a refund", msg: "I want a refund.", onlyIf: "delivered" },
    { label: "📞 Talk to manager", msg: "I want to talk to a manager." },
  ];

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) { setUnread(false); if (inputRef.current) inputRef.current.focus(); }
  }, [open]);

  function renderText(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map(function(part, i) {
      return part.startsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong> : part;
    });
  }

  async function identify() {
    setIdError("");
    const ph = inputPhone.trim().replace(/\D/g, "");
    if (ph.length < 10) { setIdError("Enter your 10-digit mobile number."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/vani/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ph }),
      });
      const d = await res.json();
      if (d.found) {
        const ctx = { phone: ph, orderId: d.orderId, orderStatus: d.status,
          customerName: d.name, canCancel: d.canCancel, refundEligible: d.refundEligible,
          hoursSinceDelivery: d.hoursSinceDelivery };
        setResolvedCtx(ctx);
        setIdentified(true); setShowQuick(true);
        const statusLine = d.status.replace(/_/g," ").toLowerCase();
        const cancelNote = d.canCancel ? " — and you can still cancel it" : "";
        setMsgs([{ role: "assistant", text: "Found it! 🎉 Order #" + d.orderId + " for " + (d.name ? d.name.split(" ")[0] : "you") + " is **" + statusLine + "**" + cancelNote + ". What do you need help with?" }]);
      } else {
        setIdError("No order found for that number. Double-check or call us at 98xxx xxxxx.");
      }
    } catch(e) { setIdError("Something went wrong. Please try again."); }
    setLoading(false);
  }

  async function send(text) {
    const userText = text || input.trim();
    if (!userText) return;
    setInput(""); setShowQuick(false);
    const newMsgs = [...msgs, { role: "user", text: userText }];
    setMsgs(newMsgs); setChatLoading(true);
    try {
      const res = await fetch("/api/vani", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, context: resolvedCtx }),
      });
      const d = await res.json();
      setMsgs(function(m) { return [...m, { role: "assistant", text: d.reply || "Our team has been notified.", escalated: d.escalated }]; });
      if (!open) setUnread(true);
    } catch(e) {
      setMsgs(function(m) { return [...m, { role: "assistant", text: "Our duty manager has been notified and will call you shortly." }]; });
    }
    setChatLoading(false);
  }

  const brand = "#E11D74", paper = "#FBF6EF", line = "#E7DDD2", ink = "#1A1614", muted = "#8A7E73";

  const statusBadge = resolvedCtx.orderStatus ? {
    PLACED: { bg:"#fbf0e1", color:"#9c5a14" },
    ACCEPTED: { bg:"#e8eefc", color:"#1d4ed8" },
    OUT_FOR_DELIVERY: { bg:"#fdeef5", color:brand },
    DELIVERED: { bg:"#e7f3ec", color:"#2F7A4D" },
  }[resolvedCtx.orderStatus] : null;

  return (
    <div>
      {/* Floating button with pulse + unread dot */}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999 }}>
        {!open && (
          <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:brand,
            animation:"vaniPulse 2s ease-out infinite", opacity:.4, zIndex:-1 }} />
        )}
        {unread && !open && (
          <div style={{ position:"absolute", top:-2, right:-2, width:14, height:14, borderRadius:"50%",
            background:"#ef4444", border:"2px solid #fff", zIndex:1 }} />
        )}
        <button onClick={function(){setOpen(function(o){return !o;});}} aria-label="Chat with Vani"
          style={{ width:56, height:56, borderRadius:"50%", border:"none", background:brand,
            color:"#fff", cursor:"pointer", boxShadow:"0 4px 20px rgba(225,29,116,.5)",
            display:"flex", alignItems:"center", justifyContent:"center", position:"relative",
            transition:"transform .15s ease", fontSize:22 }}>
          {open ? "✕" : "💬"}
        </button>
      </div>

      <style>{`
        @keyframes vaniPulse { 0%{transform:scale(1);opacity:.4} 70%{transform:scale(1.6);opacity:0} 100%{transform:scale(1.6);opacity:0} }
        @keyframes vaniBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .vani-chip:hover { background: #fdeef5 !important; border-color: #E11D74 !important; }
      `}</style>

      {open && (
        <div style={{ position:"fixed", bottom:92, right:24, zIndex:9998, width:340,
          display:"flex", flexDirection:"column",
          background:"#fff", border:"1px solid "+line, borderRadius:24,
          boxShadow:"0 12px 48px rgba(26,22,20,.2)", overflow:"hidden",
          fontFamily:"Inter, system-ui, sans-serif",
          animation:"none", maxHeight:560 }}>

          {/* Header */}
          <div style={{ background:"linear-gradient(135deg, #E11D74 0%, #c01460 100%)",
            padding:"16px 16px 14px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ position:"relative" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(255,255,255,.2)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
                  border:"2px solid rgba(255,255,255,.4)" }}>🤖</div>
                <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10,
                  borderRadius:"50%", background:"#4ade80", border:"2px solid white" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#fff", fontWeight:800, fontSize:16, letterSpacing:"-.01em" }}>Vani</div>
                <div style={{ color:"rgba(255,255,255,.8)", fontSize:11, display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", display:"inline-block" }}/>
                  SliceMatic Support · Online
                </div>
              </div>
              {resolvedCtx.orderId && statusBadge && (
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.9)", fontWeight:700 }}>
                    #{resolvedCtx.orderId}
                  </div>
                  <div style={{ fontSize:10, background:statusBadge.bg, color:statusBadge.color,
                    padding:"1px 6px", borderRadius:999, fontWeight:700, marginTop:2 }}>
                    {resolvedCtx.orderStatus.replace(/_/g," ")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Policy banner */}
          {identified && resolvedCtx.orderStatus === "OUT_FOR_DELIVERY" && (
            <div style={{ background:"#fff3cd", borderBottom:"1px solid #fde68a", padding:"7px 14px",
              fontSize:11, color:"#92400e", flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
              🛵 Rider is on the way — cancellation not possible
            </div>
          )}
          {identified && resolvedCtx.orderStatus === "DELIVERED" && resolvedCtx.refundEligible && (
            <div style={{ background:"#dcfce7", borderBottom:"1px solid #bbf7d0", padding:"7px 14px",
              fontSize:11, color:"#166534", flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
              ✓ Within 2-hour refund window — complaints accepted
            </div>
          )}

          {!identified ? (
            /* Identification screen */
            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14, background:paper }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"8px 0 4px" }}>
                <div style={{ fontSize:36, animation:"vaniBounce 1.5s ease-in-out infinite" }}>🤖</div>
                <div style={{ fontSize:14, fontWeight:700, color:ink }}>Hi! I'm Vani</div>
                <div style={{ fontSize:12, color:muted, textAlign:"center", lineHeight:1.5 }}>
                  Enter your mobile number and I'll find your latest order automatically.
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:muted, marginBottom:6,
                  textTransform:"uppercase", letterSpacing:".06em" }}>📱 Mobile number</div>
                <input value={inputPhone} onChange={function(e){setInputPhone(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter")identify();}}
                  placeholder="e.g. 9876543210" inputMode="numeric" ref={inputRef}
                  style={{ width:"100%", border:"2px solid "+line, borderRadius:12, padding:"11px 14px",
                    fontSize:14, outline:"none", background:"#fff", boxSizing:"border-box",
                    transition:"border-color .15s" }}
                  onFocus={function(e){e.target.style.borderColor=brand;}}
                  onBlur={function(e){e.target.style.borderColor=line;}} />
              </div>
              {idError && (
                <div style={{ fontSize:12, color:brand, background:"#fdeef5", padding:"8px 12px",
                  borderRadius:10, lineHeight:1.4 }}>⚠️ {idError}</div>
              )}
              <button onClick={identify} disabled={loading}
                style={{ background: loading ? "#f4a9cd" : brand, border:"none", borderRadius:12,
                  padding:"12px 0", color:"#fff", fontWeight:700, fontSize:14, cursor: loading?"not-allowed":"pointer",
                  boxShadow: loading?"none":"0 4px 12px rgba(225,29,116,.3)", transition:"all .15s" }}>
                {loading ? "🔍 Looking up your order…" : "Find my order →"}
              </button>
              <div style={{ fontSize:11, color:muted, textAlign:"center" }}>
                No order yet? <span style={{ color:brand }}>Call us at 98xxx xxxxx</span>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", display:"flex",
                flexDirection:"column", gap:10, background:paper, minHeight:0, maxHeight:340 }}>
                {msgs.map(function(m,i) {
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start",
                      alignItems:"flex-end", gap:6 }}>
                      {m.role==="assistant" && (
                        <div style={{ width:26, height:26, borderRadius:"50%", background:brand,
                          display:"flex", alignItems:"center", justifyContent:"center", fontSize:13,
                          flexShrink:0, marginBottom:2 }}>🤖</div>
                      )}
                      <div style={{ maxWidth:"78%", padding:"10px 13px", fontSize:13, lineHeight:1.55,
                        borderRadius: m.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: m.role==="user" ? brand : "#fff",
                        color: m.role==="user" ? "#fff" : ink,
                        border: m.role==="assistant" ? "1px solid "+line : "none",
                        boxShadow:"0 1px 6px rgba(26,22,20,.08)" }}>
                        {renderText(m.text)}
                        {m.escalated && (
                          <div style={{ fontSize:10, marginTop:6, paddingTop:6,
                            borderTop:"1px solid rgba(225,29,116,.2)",
                            color: m.role==="user" ? "rgba(255,255,255,.8)" : brand,
                            display:"flex", alignItems:"center", gap:4 }}>
                            🔔 Manager notified via WhatsApp
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div style={{ display:"flex", alignItems:"flex-end", gap:6 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:brand,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🤖</div>
                    <div style={{ background:"#fff", border:"1px solid "+line, borderRadius:"18px 18px 18px 4px",
                      padding:"12px 16px", display:"flex", gap:5, alignItems:"center" }}>
                      {[0,1,2].map(function(i){
                        return <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:brand,
                          animation:"vaniBounce .9s ease-in-out "+i*.15+"s infinite" }} />;
                      })}
                    </div>
                  </div>
                )}
                {showQuick && !chatLoading && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:2 }}>
                    <div style={{ fontSize:11, color:muted, textAlign:"center", marginBottom:2 }}>
                      How can I help you?
                    </div>
                    {QUICK.filter(function(q) {
                      if (q.onlyIf === "canCancel" && !resolvedCtx.canCancel) return false;
                      if (q.onlyIf === "delivered" && resolvedCtx.orderStatus !== "DELIVERED") return false;
                      return true;
                    }).map(function(q) {
                      return (
                        <button key={q.label} onClick={function(){send(q.msg);}} className="vani-chip"
                          style={{ textAlign:"left", fontSize:12, padding:"9px 13px", borderRadius:12,
                            border:"1px solid "+line, background:"#fff", cursor:"pointer", color:ink,
                            transition:"all .15s", fontWeight:500 }}>
                          {q.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop:"1px solid "+line, padding:"10px 12px", display:"flex",
                gap:8, background:"#fff", flexShrink:0, alignItems:"center" }}>
                <input value={input} onChange={function(e){setInput(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter")send();}} ref={inputRef}
                  placeholder="Type a message…"
                  style={{ flex:1, border:"1.5px solid "+line, borderRadius:12, padding:"9px 13px",
                    fontSize:13, outline:"none", background:paper, transition:"border-color .15s" }}
                  onFocus={function(e){e.target.style.borderColor=brand;}}
                  onBlur={function(e){e.target.style.borderColor=line;}} />
                <button onClick={function(){send();}}
                  style={{ background:brand, border:"none", borderRadius:12, width:38, height:38,
                    color:"#fff", fontWeight:700, cursor:"pointer", fontSize:18, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:"0 2px 8px rgba(225,29,116,.35)" }}>→</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}