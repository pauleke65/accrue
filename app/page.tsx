import Accrue from "./workspace";
import { WalletProvider } from "./wallet-context";
export default function Home() {
  return (
    <WalletProvider>
      <Accrue />
    </WalletProvider>
  );
}
