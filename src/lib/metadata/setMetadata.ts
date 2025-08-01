import { getSetPageBySlug } from '@/lib/queries/setQueries.server';
import { generateSetMetadata as generateSEOMetadata } from '@/lib/utils/seo';

export async function generateSetMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (!slug) {
        console.error("Metadata generation failed: No slug provided.");
        return {
            title: "Set Not Found",
            description: "The set you are looking for does not exist or has been moved."
        };
    }

    const setResult = await getSetPageBySlug(slug);

    if (!setResult.success || !setResult.data) {
        console.error(`Metadata generation failed: Set with slug "${slug}" not found.`);
        return {
            title: "Set Not Found",
            description: "The set you are looking for does not exist or has been moved.",
            robots: "noindex, nofollow"
        };
    }

    const set = setResult.data;

    return generateSEOMetadata({
        name: set.name,
        description: set.description || undefined,
        slug: set.slug,
        type: set.type as 'FIDELI' | 'INFIDELI',
        images: set.set_images?.map(img => ({
            image_url: img.image_url,
            alt_text: img.alt_text || set.name
        })) || []
    });
} 