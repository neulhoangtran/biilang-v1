import type { Schema, Struct } from '@strapi/strapi';

export interface CmsBlockBannerSlider extends Struct.ComponentSchema {
  collectionName: 'components_cms_block_banner_sliders';
  info: {
    displayName: 'BannerSlider';
    icon: 'book';
  };
  attributes: {
    SliderImage: Schema.Attribute.Media<'images', true> &
      Schema.Attribute.Required;
  };
}

export interface CmsBlockFeatureCategory extends Struct.ComponentSchema {
  collectionName: 'components_cms_block_feature_category';
  info: {
    displayName: 'FeatureCategory';
    icon: 'apps';
  };
  attributes: {
    Category: Schema.Attribute.Relation<'oneToOne', 'api::category.category'>;
    Products: Schema.Attribute.Relation<'oneToMany', 'api::product.product'>;
  };
}

export interface CmsBlockGridCategory extends Struct.ComponentSchema {
  collectionName: 'components_cms_block_grid_categories';
  info: {
    displayName: 'GridCategory';
    icon: 'apps';
  };
  attributes: {
    Categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    >;
  };
}

export interface CmsBlockSingleImage extends Struct.ComponentSchema {
  collectionName: 'components_cms_block_single_images';
  info: {
    displayName: 'SingleImage';
    icon: 'book';
  };
  attributes: {
    Image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'cms-block.banner-slider': CmsBlockBannerSlider;
      'cms-block.feature-category': CmsBlockFeatureCategory;
      'cms-block.grid-category': CmsBlockGridCategory;
      'cms-block.single-image': CmsBlockSingleImage;
    }
  }
}
