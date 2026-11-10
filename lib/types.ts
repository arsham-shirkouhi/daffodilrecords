export interface DiscogsArtist {
  id?: number;
  name: string;
  anv?: string;
  join?: string;
  role?: string;
  tracks?: string;
  resource_url?: string;
}

export interface DiscogsLabel {
  id?: number;
  name: string;
  catno?: string;
  entity_type?: string;
  entity_type_name?: string;
  resource_url?: string;
}

export interface DiscogsFormat {
  name?: string;
  qty?: string;
  descriptions?: string[];
  text?: string;
}

export interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface DiscogsBasicInformation {
  id: number;
  title: string;
  year?: number;
  artists?: DiscogsArtist[];
  labels?: DiscogsLabel[];
  formats?: DiscogsFormat[];
  genres?: string[];
  styles?: string[];
  cover_image?: string;
  thumb?: string;
  resource_url?: string;
  master_id?: number;
  master_url?: string;
}

export interface DiscogsCollectionNote {
  field_id?: number;
  value?: string;
}

export interface DiscogsCollectionRelease {
  id: number;
  instance_id: number;
  folder_id?: number;
  date_added?: string;
  rating?: number;
  notes?: DiscogsCollectionNote[];
  basic_information?: DiscogsBasicInformation;
}

export interface DiscogsCollectionResponse {
  pagination: DiscogsPagination;
  releases: DiscogsCollectionRelease[];
}

export interface DiscogsImage {
  type?: string;
  uri?: string;
  uri150?: string;
  width?: number;
  height?: number;
  resource_url?: string;
}

export interface DiscogsTrack {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  artists?: DiscogsArtist[];
  extraartists?: DiscogsArtist[];
}

export interface DiscogsRelease {
  id: number;
  title: string;
  year?: number;
  country?: string;
  notes?: string;
  uri?: string;
  artists?: DiscogsArtist[];
  labels?: DiscogsLabel[];
  formats?: DiscogsFormat[];
  genres?: string[];
  styles?: string[];
  thumb?: string;
  cover_image?: string;
  images?: DiscogsImage[];
  tracklist?: DiscogsTrack[];
  community?: {
    have?: number;
    want?: number;
    rating?: { count?: number; average?: number };
  };
  lowest_price?: number | null;
  num_for_sale?: number | null;
}

export interface DiscogsMarketplaceStats {
  lowest_price?: { value?: number; currency?: string } | null;
  num_for_sale?: number;
  blocked_from_sale?: boolean;
}

export interface DiscogsIdentity {
  id: number;
  username: string;
  resource_url?: string;
  consumer_name?: string;
}

export interface DiscogsUser {
  id?: number;
  username?: string;
  name?: string;
  avatar_url?: string;
  profile?: string;
}

export interface CollectionNote {
  fieldId: number;
  value: string;
}

export interface CollectionRecord {
  id: number;
  instance_id: number;
  folder_id: number;
  title: string;
  artists: string[];
  year: number;
  labels: string[];
  formats: string;
  genres: string[];
  styles: string[];
  cover_image: string | null;
  thumb: string | null;
  date_added: string;
  rating: number;
  notes: CollectionNote[];
}

export interface CollectionFolder {
  id: number;
  name: string;
  count: number;
}

export interface CollectionField {
  id: number;
  name: string;
  options: string[];
}

export interface WantRecord {
  id: number;
  title: string;
  artists: string[];
  year: number;
  labels: string[];
  formats: string;
  cover_image: string | null;
  thumb: string | null;
  date_added: string;
}

export interface SearchRelease {
  id: number;
  master_id: number | null;
  title: string;
  artist: string;
  year: number;
  country: string;
  label: string;
  catno: string;
  format: string;
  cover_image: string | null;
}

export interface ReleaseTrack {
  position: string;
  title: string;
  duration: string;
  type: "track" | "heading";
  artists: string[];
}

export interface ReleaseImage {
  uri: string;
  thumb: string;
  type: string;
}

export interface ReleaseDetail {
  id: number;
  title: string;
  artists: string[];
  year: number;
  country: string | null;
  notes: string | null;
  labels: { name: string; catno: string }[];
  formats: string;
  genres: string[];
  styles: string[];
  tracklist: ReleaseTrack[];
  images: ReleaseImage[];
  cover_image: string | null;
  thumb: string | null;
  community: { have: number; want: number };
  lowest_price: number | null;
  num_for_sale: number | null;
  uri: string;
}

export interface PriceInfo {
  lowest_price: number | null;
  currency: string;
  num_for_sale: number;
}

export interface Me {
  username: string;
  avatar: string | null;
  name: string;
}

export interface CollectionProgress {
  page: number;
  pages: number;
  loaded: number;
  total: number;
}

export interface OAuthTokenPair {
  oauth_token: string;
  oauth_token_secret: string;
}
