import { money, fmtDateTime, label } from '../lib/api';

// 80mm thermal-style bill. Printed through the browser, which works with any connected receipt printer.
export default function Receipt({ order, restaurant }) {
  return (
    <div id="receipt" className="mx-auto w-[300px] bg-white p-4 font-mono text-xs leading-relaxed text-black">
      <div className="text-center">
        <p className="text-base font-bold">{restaurant?.name}</p>
        {order.branch?.name && <p>{order.branch.name}</p>}
        {order.branch?.address && <p>{order.branch.address}</p>}
        {(order.branch?.phone || restaurant?.phone) && <p>{order.branch?.phone || restaurant.phone}</p>}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <p>Bill: {order.orderNo}</p><p>{fmtDateTime(order.createdAt)}</p>
      <p>{label(order.type)}{order.tableNo ? ` · Table ${order.tableNo}` : ''}</p>
      {order.customerName && <p>Customer: {order.customerName}</p>}
      <hr className="my-2 border-dashed border-black" />
      {order.items.map((i, k) => (
        <div key={k} className="flex justify-between gap-2"><span>{i.qty} x {i.name}</span><span>{Math.round(i.price * i.qty).toLocaleString()}</span></div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between"><span>Subtotal</span><span>{Math.round(order.subtotal).toLocaleString()}</span></div>
      {order.discount > 0 && <div className="flex justify-between"><span>Discount {order.coupon || ''}</span><span>-{Math.round(order.discount).toLocaleString()}</span></div>}
      {order.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>{Math.round(order.tax).toLocaleString()}</span></div>}
      {order.serviceFee > 0 && <div className="flex justify-between"><span>Service fee</span><span>{Math.round(order.serviceFee).toLocaleString()}</span></div>}
      <div className="mt-1 flex justify-between border-t border-black pt-1 text-sm font-bold"><span>TOTAL (Rs)</span><span>{Math.round(order.total).toLocaleString()}</span></div>
      <p className="mt-1">Paid by: {label(order.paymentMethod)} ({label(order.paymentStatus)})</p>
      <p className="mt-3 text-center">Thank you for dining with us</p>
    </div>
  );
}

export function printBill() {
  try { if (typeof window.print !== 'function') throw new Error('no printer'); window.print(); return true; } catch { return false; }
}
