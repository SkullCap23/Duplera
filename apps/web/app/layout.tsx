import type {Metadata} from "next";
import "./style.css";
export const metadata:Metadata={title:"Duplera | Invoice financing registry",description:"A verifiable registry for synthetic invoice financing claims"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
