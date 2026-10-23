import{eq}from'drizzle-orm';import{bookingRequests}from'../drizzle/schema';import{isPaidPaymentStatus}from'../shared/payment-status';import{isRefundHeld}from'./refund-proof';
// Refund approval takes the same booking lock before examining active jobs and
// mail attempts. Whichever operation claims the booking first defines the order.
export async function withPaidBookingLock<T>(db:any,bookingId:number,action:(tx:any,booking:any)=>Promise<T>,synthetic=false):Promise<T>{
 return db.transaction(async(tx:any)=>{
  const booking=(await tx.select().from(bookingRequests).where(eq(bookingRequests.id,bookingId)).for('update'))[0];
  if(!booking)throw Error('Booking request not found');
  if(isRefundHeld(booking.paymentStatus))throw Error('Refunded orders cannot start fulfillment');
  if(!synthetic&&!isPaidPaymentStatus(booking.paymentStatus))throw Error('Fulfillment requires a confirmed payment');
  return action(tx,booking);
 });
}
