// routes.jsx — React Router 설정
import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Market } from './pages/Market';
import { NFTDetail } from './pages/NFTDetail';
import { MyNFTs } from './pages/MyNFTs';
import { RegisterNFT } from './pages/RegisterNFT';
import { Execute } from './pages/Execute';
import { Admin } from './pages/Admin';
import { TransactionHistory } from './pages/TransactionHistory';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Market /> },
      { path: 'nft/:id', element: <NFTDetail /> },
      { path: 'my-nfts', element: <MyNFTs /> },
      { path: 'register', element: <RegisterNFT /> },
      { path: 'execute', element: <Execute /> },
      { path: 'transactions', element: <TransactionHistory /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
]);
