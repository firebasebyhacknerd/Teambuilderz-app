<<<<<<< HEAD
﻿export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  };
}
=======
import { useEffect } from 'react';
import { useRouter } from 'next/router';
>>>>>>> 45aef2e4e76cf2dc9053192f0b3a49cac1475811

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}

