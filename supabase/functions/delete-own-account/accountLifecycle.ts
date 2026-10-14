export const DELETE_ACCOUNT_CONFIRMATION='DELETE MY ACCOUNT';
export const DELETE_HISTORY_CONFIRMATION='DELETE HISTORY';
export function validateDestructiveRequest(input:unknown,confirmation:string){
 if(!input||typeof input!=='object'||Array.isArray(input)||(input as {confirmation?:unknown}).confirmation!==confirmation)throw new Error(`Type ${confirmation} to confirm.`);
}
export async function deleteOwnAccount(userId:string,confirmation:unknown,actions:{recentSession:()=>Promise<boolean>;revoke:()=>Promise<void>;remove:(id:string)=>Promise<void>}){
 validateDestructiveRequest({confirmation},DELETE_ACCOUNT_CONFIRMATION);
 if(!userId||!await actions.recentSession())throw new Error('Sign in again before deleting your account.');
 await actions.revoke();
 // No caller-supplied account ID is accepted; only the authenticated owner.
 await actions.remove(userId);
}
