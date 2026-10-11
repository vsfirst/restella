terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
  }

  # bootstrap은 state 버킷 자체를 만들므로 로컬 state를 쓴다.
  # terraform.tfstate는 .gitignore로 제외된다.
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "restella"
      Environment = "shared"
      ManagedBy   = "terraform"
      Stack       = "bootstrap"
    }
  }
}
