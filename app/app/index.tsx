import { useEffect } from 'react';
import { router } from 'expo-router';

import { getInitialAuthTarget } from '@/services/auth-flow.service';

export default function IndexScreen() {
    useEffect(() => {
        let mounted = true;

        async function bootstrapApp() {
            try {
                const target = await getInitialAuthTarget();

                if (!mounted) {
                    return;
                }

                router.replace(target as any);
            } catch (error) {
                console.log('[INDEX_BOOTSTRAP_ERROR]', error);

                if (mounted) {
                    router.replace('/welcome');
                }
            }
        }

        bootstrapApp();

        return () => {
            mounted = false;
        };
    }, []);

    return null;
}