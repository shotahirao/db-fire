import { AppLayout } from './components/Layout/AppLayout';
import { useUpdater } from './hooks/useUpdater';

function App() {
  useUpdater();

  return <AppLayout />;
}

export default App;
