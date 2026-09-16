import { createContext, useContext } from "react";
export const CRMContext = createContext(null);
export const useCRM = () => useContext(CRMContext);
