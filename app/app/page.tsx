import Accrue from "../workspace";
import { WalletProvider } from "../wallet-context";
import { TagGateProvider } from "../ui/tag-gate";
export default function Home() {
  return (
    <WalletProvider>
      <TagGateProvider>
        <Accrue />
      </TagGateProvider>
    </WalletProvider>
  );
}
