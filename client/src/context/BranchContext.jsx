import { createContext, useContext } from 'react';
export const BranchCtx = createContext({ branches: [], branch: '', setBranch: () => {}, canPick: false });
export const useBranch = () => useContext(BranchCtx);
